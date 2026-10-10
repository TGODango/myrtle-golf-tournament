-- Single tournament, JSON aggregate with atomic score mutations and optimistic revisions.
create table public.tournaments(id integer primary key check(id=1), state jsonb not null, revision bigint not null default 0);
create table public.members(user_id uuid primary key references auth.users(id), player_id text unique not null, role text not null check(role in ('admin','captain','golfer')));
create table public.score_requests(request_id uuid primary key, user_id uuid not null, payload jsonb not null);
create table public.audit(id bigint generated always as identity primary key, actor uuid, at timestamptz default now(), action text, before_value jsonb, after_value jsonb);
alter table public.tournaments enable row level security;
alter table public.members enable row level security;
alter table public.score_requests enable row level security;
alter table public.audit enable row level security;
create policy member_self on public.members for select to authenticated using(user_id=auth.uid());
create policy tournament_read on public.tournaments for select to authenticated using(exists(select 1 from public.members where user_id=auth.uid()));
create policy audit_admin on public.audit for select to authenticated using(exists(select 1 from public.members where user_id=auth.uid() and role='admin'));
-- No direct client writes: all changes pass through checked functions.
create function public.read_tournament() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from members where user_id=auth.uid()) then raise exception 'Tournament invitation required';end if;
 return (select jsonb_build_object('state',state,'revision',revision) from tournaments where id=1);
end $$;
create function public.submit_score(p_match text,p_player text,p_hole integer,p_gross integer,p_expected integer,p_request uuid) returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; m jsonb; r jsonb; k text; old jsonb; payload jsonb; prior score_requests; member members;
begin
 select * into member from members where user_id=auth.uid();
 if member.user_id is null or (member.player_id<>p_player and member.role<>'admin') then raise exception 'Not authorized for this player';end if;
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
 if coalesce((m->>'approved')::boolean,false)=false or coalesce((r->>'locked')::boolean,false)=false or coalesce((r->>'verified')::boolean,false)=false or jsonb_array_length(r->'holes')<>18 then raise exception 'Verified course and locked approved pairings required';end if;
 k:=p_match||':'||p_player||':'||p_hole;old:=t.state->'scores'->k;
 if coalesce((old->>'version')::integer,0)<>p_expected then raise exception 'Conflict: score changed; review current value before retry';end if;
 insert into score_requests values(p_request,auth.uid(),payload);
 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'score '||k,old,payload);
 t.state:=jsonb_set(t.state,array['scores',k],jsonb_build_object('gross',p_gross,'version',p_expected+1));
 t.state:=jsonb_set(t.state,array['audit'],jsonb_build_array(jsonb_build_object('at',now(),'message','Score '||k||' corrected to '||p_gross))||coalesce(t.state->'audit','[]'));
 update tournaments set state=t.state,revision=revision+1 where id=1;
end $$;
create function public.update_tournament(p_state jsonb,p_expected bigint) returns void language plpgsql security definer set search_path=public as $$
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
  if (r->>'format') not in ('bestball','stableford','shamble','singles') then raise exception 'Invalid scoring format';end if;
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
create function public.save_draft(p_match jsonb) returns void language plpgsql security definer set search_path=public as $$
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
  if exists(select 1 from jsonb_array_elements(t.state->'matches') x where x->>'round'=r->>'id' and x->>'id'<>p_match->>'id' and ((x->'a')?player_key or (x->'b')?player_key)) then raise exception 'Player already paired';end if;
 end loop;
 if (select count(distinct x) from jsonb_array_elements_text(p_match->side) x)<>size then raise exception 'Duplicate player';end if;
 p_match:=(p_match-'manual'-'reopened')||jsonb_build_object('approved',false);
 select coalesce(jsonb_agg(x),'[]') into others from jsonb_array_elements(t.state->'matches') x where x->>'id'<>p_match->>'id';
 insert into audit(actor,action,before_value,after_value) values(auth.uid(),'draft',old,p_match);
 update tournaments set state=jsonb_set(t.state,array['matches'],others||jsonb_build_array(p_match)),revision=revision+1 where id=1;
end $$;
revoke all on function public.read_tournament(),public.submit_score(text,text,integer,integer,integer,uuid),public.update_tournament(jsonb,bigint),public.save_draft(jsonb) from public;
grant execute on function public.read_tournament(),public.submit_score(text,text,integer,integer,integer,uuid),public.update_tournament(jsonb,bigint),public.save_draft(jsonb) to authenticated;
alter publication supabase_realtime add table public.tournaments;
