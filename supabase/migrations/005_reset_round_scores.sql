CREATE OR REPLACE FUNCTION public.reset_round_scores(p_round text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.tournaments; removed integer; next_scores jsonb; match_ids text[];
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.members WHERE user_id=auth.uid() AND role='admin')
 THEN RAISE EXCEPTION 'Administrator required'; END IF;
 SELECT * INTO t FROM public.tournaments WHERE id=1 FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.state->'rounds') r WHERE r->>'id'=p_round)
 THEN RAISE EXCEPTION 'Unknown round'; END IF;
 SELECT coalesce(array_agg(m->>'id'),ARRAY[]::text[]) INTO match_ids
 FROM jsonb_array_elements(t.state->'matches') m WHERE m->>'round'=p_round;
 SELECT count(*) INTO removed FROM jsonb_each(coalesce(t.state->'scores','{}'::jsonb)) e
 WHERE split_part(e.key,':',1)=ANY(match_ids);
 SELECT coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) INTO next_scores
 FROM jsonb_each(coalesce(t.state->'scores','{}'::jsonb)) e
 WHERE NOT (split_part(e.key,':',1)=ANY(match_ids));
 INSERT INTO public.audit(actor,action,before_value,after_value)
 VALUES(auth.uid(),'reset round scores '||p_round,t.state->'scores',next_scores);
 t.state:=jsonb_set(t.state,'{scores}',next_scores);
 t.state:=jsonb_set(t.state,'{audit}',jsonb_build_array(jsonb_build_object('at',now(),'message','Round '||p_round||' scores reset by administrator'))||coalesce(t.state->'audit','[]'::jsonb));
 UPDATE public.tournaments SET state=t.state,revision=revision+1 WHERE id=1;
 RETURN removed;
END $function$
;
REVOKE ALL ON FUNCTION public.reset_round_scores(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_round_scores(text) TO authenticated;
