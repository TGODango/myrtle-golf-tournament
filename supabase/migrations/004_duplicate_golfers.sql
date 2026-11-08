-- Preserve current deployed function behavior while permitting duplicate match assignments.
CREATE OR REPLACE FUNCTION public.update_tournament(p_state jsonb, p_expected bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if (select count(distinct x) from jsonb_array_elements_text(m->'a') x)<>size
      or (select count(distinct x) from jsonb_array_elements_text(m->'b') x)<>size
      or exists(select 1 from jsonb_array_elements_text(m->'a') x where m->'b' ? x)
      then raise exception 'Duplicate golfer within match'; end if;
    for team in 0..1 loop
     for pid in select jsonb_array_elements_text(case when team=0 then m->'a' else m->'b' end) loop
      if not exists(select 1 from jsonb_array_elements(p_state->'players') x where x->>'id'=pid and (x->>'team')::int=team) then raise exception 'Wrong-team player';end if;
      used:=array_append(used,pid);
     end loop;
    end loop;
   end loop;
  end if;
 end loop;

 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'administration',t.state,p_state);
 update tournaments set state=p_state,revision=revision+1 where id=1;
end $function$
;

CREATE OR REPLACE FUNCTION public.save_draft(p_match jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t tournaments; member members; r jsonb; old jsonb; p jsonb; team integer; side text; opp text; size integer; others jsonb; player_key text;
begin
 select * into member from members where user_id=auth.uid();
 if member.role<>'captain' or member.user_id is null then raise exception 'Captain required';end if;
 select * into t from tournaments where id=1 for update;
 select x into p from jsonb_array_elements(t.state->'players') x where x->>'id'=member.player_id;
 if coalesce((p->>'captain')::boolean,false)=false then raise exception 'Assigned captain required';end if;
 team:=(p->>'team')::integer;side:=case when team=0 then 'a' else 'b' end;opp:=case when team=0 then 'b' else 'a' end;
 select x into r from jsonb_array_elements(t.state->'rounds') x where x->>'id'=p_match->>'round';
 if r is null or coalesce((r->>'locked')::boolean,false) then raise exception 'Round unavailable or locked';end if;
 size:=case when r->>'format'='singles' then 1 else 2 end;
 select x into old from jsonb_array_elements(t.state->'matches') x where x->>'id'=p_match->>'id';
 if old is not null and old->>'round'<>p_match->>'round' then raise exception 'Round cannot change';end if;
 if old is null and (p_match->>'nomination')::integer<>coalesce((r->>'nomination')::integer,0) then raise exception 'Administrator selects nominating captain';end if;
 if old is not null and old->'nomination' is distinct from p_match->'nomination' then raise exception 'Cannot change nomination order';end if;
 if (p_match->>'slot')::integer not between 0 and 2 then raise exception 'Invalid foursome';end if;
 if old is not null and old->'slot' is distinct from p_match->'slot' then raise exception 'Administrator assigns tee times';end if;
 if old is not null and old->'position' is distinct from p_match->'position' then raise exception 'Match order cannot change';end if;
 if old is null and (p_match->>'nomination')::integer<>team then raise exception 'Nominating captain must select first';end if;
 if old is not null and (old->opp)<>(p_match->opp) then raise exception 'Cannot change opposing captain selections';end if;
 if old is null and jsonb_array_length(p_match->opp)<>0 then raise exception 'Opposing captain chooses their own players';end if;
 if jsonb_array_length(p_match->side)<>size then raise exception 'Invalid pair size';end if;
 for player_key in select jsonb_array_elements_text(p_match->side) loop
  if not exists(select 1 from jsonb_array_elements(t.state->'players') x where x->>'id'=player_key and (x->>'team')::integer=team) then raise exception 'Wrong team';end if;
 end loop;
 if (select count(distinct x) from jsonb_array_elements_text(p_match->side) x)<>size then raise exception 'Duplicate player';end if;
 p_match:=(p_match-'manual'-'reopened')||jsonb_build_object('approved',false);
 select coalesce(jsonb_agg(x),'[]') into others from jsonb_array_elements(t.state->'matches') x where x->>'id'<>p_match->>'id';
 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'draft',old,p_match);
 update tournaments set state=jsonb_set(t.state,array['matches'],others||jsonb_build_array(p_match)),revision=revision+1 where id=1;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_foursome_scores(p_entries jsonb, p_request uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t tournaments; member members; prior score_requests; e jsonb; m jsonb; r jsonb; k text; old jsonb; seen text[]:=array[]::text[]; slot_id integer; round_id text; expected_count integer; match_count integer; other_match jsonb; mirror_key text; mirror_old jsonb;
begin
 select * into member from members where user_id=auth.uid();
 if member.user_id is null then raise exception 'Not authorized'; end if;
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not in (2,4) then raise exception 'Invalid foursome'; end if;
 select * into t from tournaments where id=1 for update;
 select * into prior from score_requests where request_id=p_request;
 if found then
  if prior.user_id=auth.uid() and prior.payload=p_entries then return; else raise exception 'Request identifier conflict'; end if;
 end if;
 select x into m from jsonb_array_elements(t.state->'matches') x where x->>'id'=p_entries->0->>'match';
 if m is null then raise exception 'Unknown match'; end if;
 select x into r from jsonb_array_elements(t.state->'rounds') x where x->>'id'=m->>'round';
 round_id:=r->>'id'; slot_id:=(m->>'slot')::integer;
 if member.role<>'admin' and not exists(select 1 from jsonb_array_elements(t.state->'matches') x where x->>'round'=round_id and (x->>'slot')::integer=slot_id and ((x->'a') ? member.player_id or (x->'b') ? member.player_id)) then raise exception 'Not in this foursome'; end if;
 if not coalesce((r->>'locked')::boolean,false) or not coalesce((r->>'verified')::boolean,false) or jsonb_array_length(r->'holes')<>18 then raise exception 'Course and pairings must be approved'; end if;
 expected_count:=case when r->>'format'='scramble' then 2 else 4 end;
 if jsonb_array_length(p_entries)<>expected_count then raise exception 'Incorrect score count'; end if;
 select count(*) into match_count from jsonb_array_elements(t.state->'matches') x where x->>'round'=round_id and (x->>'slot')::integer=slot_id;
 if match_count<>(case when r->>'format'='singles' then 2 else 1 end) then raise exception 'Foursome pairing incomplete'; end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  select x into m from jsonb_array_elements(t.state->'matches') x where x->>'id'=e->>'match';
  if m is null or m->>'round'<>round_id or (m->>'slot')::integer<>slot_id or not coalesce((m->>'approved')::boolean,false) then raise exception 'Score outside approved foursome'; end if;
  if not ((m->'a') ? (e->>'player') or (m->'b') ? (e->>'player')) then raise exception 'Player not in match'; end if;
  if r->>'format'='scramble' and e->>'player'<>m->'a'->>0 and e->>'player'<>m->'b'->>0 then raise exception 'Invalid scramble team'; end if;
  if (e->>'hole')::integer not between 0 and 17 or (e->>'gross')::integer not between 1 and 30 or (e->>'hole')::integer<>(p_entries->0->>'hole')::integer then raise exception 'Invalid score or hole'; end if;
  k:=concat(e->>'match',':',e->>'player',':',e->>'hole');
  if k=any(seen) then raise exception 'Duplicate score'; end if;
  seen:=array_append(seen,k); old:=t.state->'scores'->k;
  if coalesce((old->>'version')::integer,0)<>(e->>'expected')::integer then raise exception 'Score changed; reload and review'; end if;
 end loop;
 -- Validate the complete roster, not merely the count.
 for m in select x from jsonb_array_elements(t.state->'matches') x where x->>'round'=round_id and (x->>'slot')::integer=slot_id loop
  for e in select value from jsonb_array_elements(case when r->>'format'='scramble' then jsonb_build_array(m->'a'->0,m->'b'->0) else (m->'a')||(m->'b') end) loop
   if not exists(select 1 from jsonb_array_elements(p_entries) x where x->>'match'=m->>'id' and x->>'player'=e#>>'{}') then raise exception 'Missing foursome player'; end if;
  end loop;
 end loop;
 for e in select value from jsonb_array_elements(p_entries) loop
  k:=concat(e->>'match',':',e->>'player',':',e->>'hole'); old:=t.state->'scores'->k;
  insert into audit(actor,action,before_value,after_value) values(auth.uid(),'foursome score '||k,old,e);
  t.state:=jsonb_set(t.state,array['scores',k],jsonb_build_object('gross',(e->>'gross')::integer,'version',(e->>'expected')::integer+1));
  for other_match in select x from jsonb_array_elements(t.state->'matches') x
    where x->>'round'=round_id and x->>'id'<>e->>'match'
      and ((x->'a') ? (e->>'player') or (x->'b') ? (e->>'player')) loop
    mirror_key:=concat(other_match->>'id',':',e->>'player',':',e->>'hole');
    mirror_old:=t.state->'scores'->mirror_key;
    t.state:=jsonb_set(t.state,array['scores',mirror_key],
      jsonb_build_object('gross',(e->>'gross')::integer,
        'version',coalesce((mirror_old->>'version')::integer,0)+1));
  end loop;
 end loop;
 insert into score_requests(request_id,user_id,payload) values(p_request,auth.uid(),p_entries);
 t.state:=jsonb_set(t.state,array['audit'],jsonb_build_array(jsonb_build_object('at',now(),'message','Foursome scores saved for '||round_id||' hole '||(p_entries->0->>'hole')))||coalesce(t.state->'audit','[]'));
 update tournaments set state=t.state,revision=revision+1 where id=1;
end $function$
;
