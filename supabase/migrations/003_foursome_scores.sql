-- One authorized golfer can submit their entire tee-time group's scores atomically.
create or replace function public.submit_foursome_scores(p_entries jsonb,p_request uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; member members; prior score_requests; e jsonb; m jsonb; r jsonb; k text; old jsonb; seen text[]:=array[]::text[]; slot_id integer; round_id text; expected_count integer; match_count integer;
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
  k:=e->>'match'||':'||e->>'player'||':'||e->>'hole';
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
  k:=e->>'match'||':'||e->>'player'||':'||e->>'hole'; old:=t.state->'scores'->k;
  insert into audit(actor,action,before_value,after_value) values(auth.uid(),'foursome score '||k,old,e);
  t.state:=jsonb_set(t.state,array['scores',k],jsonb_build_object('gross',(e->>'gross')::integer,'version',(e->>'expected')::integer+1));
 end loop;
 insert into score_requests(request_id,user_id,payload) values(p_request,auth.uid(),p_entries);
 t.state:=jsonb_set(t.state,array['audit'],jsonb_build_array(jsonb_build_object('at',now(),'message','Foursome scores saved for '||round_id||' hole '||(p_entries->0->>'hole')))||coalesce(t.state->'audit','[]'));
 update tournaments set state=t.state,revision=revision+1 where id=1;
end $$;
revoke all on function public.submit_foursome_scores(jsonb,uuid) from public, anon;
grant execute on function public.submit_foursome_scores(jsonb,uuid) to authenticated;
