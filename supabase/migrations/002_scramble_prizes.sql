-- Upgrade existing RPCs without replacing or resetting the live tournament state.
-- Supports scramble team-score entries, both partners entering a shared score,
-- and administrator-controlled prize settings in the existing state JSON.
create or replace function public.submit_score(p_match text,p_player text,p_hole integer,p_gross integer,p_expected integer,p_request uuid) returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; m jsonb; r jsonb; k text; old jsonb; payload jsonb; prior score_requests; member members;
begin
 select * into member from members where user_id=auth.uid();
 if member.user_id is null then raise exception 'Not authorized';end if;
 if p_hole<0 or p_hole>17 or p_gross<1 or p_gross>30 then raise exception 'Invalid score';end if;
 payload:=jsonb_build_object('match',p_match,'player',p_player,'hole',p_hole,'gross',p_gross,'expected',p_expected);
 select * into t from tournaments where id=1 for update;
 select * into prior from score_requests where request_id=p_request;
 if found then
  if prior.user_id=auth.uid() and prior.payload=payload then return;else raise exception 'Request identifier conflict';end if;
 end if;
 select x into m from jsonb_array_elements(t.state->'matches') x where x->>'id'=p_match;
 select x into r from jsonb_array_elements(t.state->'rounds') x where x->>'id'=m->>'round';
 if m is null or not ((m->'a') ? p_player or (m->'b') ? p_player) then raise exception 'Player not in match';end if;
 if member.role<>'admin' and member.player_id<>p_player then
   if r->>'format'<>'scramble' or not ((m->'a' ? member.player_id and m->'a'->>0=p_player) or (m->'b' ? member.player_id and m->'b'->>0=p_player)) then raise exception 'Not authorized for this score';end if;
 end if;
 if r->>'format'='scramble' and p_player<>m->'a'->>0 and p_player<>m->'b'->>0 then raise exception 'Scramble score must use designated pair record';end if;
 if coalesce((m->>'approved')::boolean,false)=false or coalesce((r->>'locked')::boolean,false)=false or coalesce((r->>'verified')::boolean,false)=false or jsonb_array_length(r->'holes')<>18 then raise exception 'Verified course and locked approved pairings required';end if;
 k:=p_match||':'||p_player||':'||p_hole;old:=t.state->'scores'->k;
 if coalesce((old->>'version')::integer,0)<>p_expected then raise exception 'Conflict: score changed; review current value before retry';end if;
 insert into score_requests values(p_request,auth.uid(),payload);
 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'score '||k,old,payload);
 t.state:=jsonb_set(t.state,array['scores',k],jsonb_build_object('gross',p_gross,'version',p_expected+1));
 t.state:=jsonb_set(t.state,array['audit'],jsonb_build_array(jsonb_build_object('at',now(),'message','Score '||k||' corrected to '||p_gross))||coalesce(t.state->'audit','[]'));
 update tournaments set state=t.state,revision=revision+1 where id=1;
end $$;

create or replace function public.update_tournament(p_state jsonb,p_expected bigint) returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; r jsonb; m jsonb; p jsonb; used text[]; ids text[]; pid text; size integer; slot integer; team integer;
begin
 if not exists(select 1 from members where user_id=auth.uid() and role='admin') then raise exception 'Administrator required';end if;
 select * into t from tournaments where id=1 for update;
 if t.revision<>p_expected then raise exception 'Conflict: tournament changed, reload before saving';end if;
 if jsonb_array_length(p_state->'players')>12 or jsonb_array_length(p_state->'rounds')<>5 or jsonb_array_length(p_state->'teams')<>2 then raise exception 'Invalid tournament structure';end if;
 if p_state->'scores'<>t.state->'scores' then raise exception 'Use submit_score for audited score corrections';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_state->'players') x)<>jsonb_array_length(p_state->'players') then raise exception 'Duplicate player IDs';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_state->'matches') x)<>jsonb_array_length(p_state->'matches') then raise exception 'Duplicate match IDs';end if;
 for r in select * from jsonb_array_elements(p_state->'rounds') loop
  if (r->>'format') not in ('bestball','stableford','shamble','scramble','singles') then raise exception 'Invalid scoring format';end if;
  if coalesce((r->>'verified')::boolean,false) then
   if jsonb_array_length(r->'holes')<>18 or (r->>'slope')::numeric<55 or (r->>'slope')::numeric>155 or (r->>'rating')::numeric<=0 then raise exception 'Invalid verified scorecard';end if;
   if (select count(distinct (x->>'rank')::int) from jsonb_array_elements(r->'holes') x)<>18 or exists(select 1 from jsonb_array_elements(r->'holes') x where (x->>'rank')::int not between 1 and 18 or (x->>'par')::int not between 3 and 6 or (x->>'yards')::numeric<=0) then raise exception 'Invalid hole data';end if;
  end if;
  if coalesce((r->>'locked')::boolean,false) then
   size:=case when r->>'format'='singles' then 1 else 2 end;
   if (select count(*) from jsonb_array_elements(p_state->'matches') x where x->>'round'=r->>'id')<>6/size then raise exception 'Round match count invalid';end if;
   for team in 0..1 loop
    if (select count(*) from jsonb_array_elements(p_state->'players') x where (x->>'team')::int=team)<>6 or (select count(*) from jsonb_array_elements(p_state->'players') x where (x->>'team')::int=team and (x->>'captain')::boolean)<>1 then raise exception 'Six players and one captain per team required';end if;
   end loop;
   for slot in 0..2 loop
    if (select count(*) from jsonb_array_elements(p_state->'matches') x where x->>'round'=r->>'id' and (x->>'slot')::int=slot)<>2/size then raise exception 'Foursome capacity invalid';end if;
   end loop;
   used:=array[]::text[];
   for m in select x from jsonb_array_elements(p_state->'matches') x where x->>'round'=r->>'id' loop
    if jsonb_array_length(m->'a')<>size or jsonb_array_length(m->'b')<>size or not coalesce((m->>'approved')::boolean,false) then raise exception 'Invalid approved pairing';end if;
    for team in 0..1 loop
     for pid in select jsonb_array_elements_text(case when team=0 then m->'a' else m->'b' end) loop
      if pid=any(used) or not exists(select 1 from jsonb_array_elements(p_state->'players') x where x->>'id'=pid and (x->>'team')::int=team) then raise exception 'Duplicate or wrong-team player';end if;
      used:=array_append(used,pid);
     end loop;
    end loop;
   end loop;
  end if;
 end loop;

 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'administration',t.state,p_state);
 update tournaments set state=p_state,revision=revision+1 where id=1;
end $$;

