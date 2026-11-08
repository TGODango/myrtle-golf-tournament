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
 if jsonb_array_length(p_state->'players')>24 or jsonb_array_length(p_state->'rounds')<>5 or jsonb_array_length(p_state->'teams')<>2 then raise exception 'Invalid tournament structure';end if;
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
    if (select count(*) from jsonb_array_elements(p_state->'players') x where (x->>'team')::int=team)<6 or (select count(*) from jsonb_array_elements(p_state->'players') x where (x->>'team')::int=team and (x->>'captain')::boolean)<>1 then raise exception 'At least six players and exactly one captain per team required';end if;
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

