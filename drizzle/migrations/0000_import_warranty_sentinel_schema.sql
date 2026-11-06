CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  claim_id text NOT NULL,
  serial_number text NOT NULL,
  dealer_id text NOT NULL,
  repair_type text NOT NULL,
  claim_amount numeric NOT NULL DEFAULT 0,
  labor_hours numeric NOT NULL DEFAULT 0,
  narrative text NOT NULL DEFAULT '',
  risk_score integer,
  system_decision text,
  ai_result jsonb,
  rule_results jsonb,
  status text NOT NULL DEFAULT 'RECEIVED',
  human_decision text,
  reviewer text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims select" ON public.claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own claims insert" ON public.claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own claims update" ON public.claims FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX claims_user_idx ON public.claims(user_id, created_at DESC);

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_uuid uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit select" ON public.audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX audit_claim_idx ON public.audit_events(claim_uuid, created_at);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text NOT NULL DEFAULT '', avatar_url text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE FUNCTION public.create_reviewer_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN INSERT INTO public.profiles(id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$;
CREATE TRIGGER create_reviewer_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_reviewer_profile();
INSERT INTO public.profiles(id, display_name) SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') FROM auth.users ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.claims ADD COLUMN analysis_snapshot jsonb;
ALTER TABLE public.claims ADD COLUMN ai_outcome jsonb;
ALTER POLICY "own audit insert" ON public.audit_events WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_uuid AND c.user_id = auth.uid()));
CREATE FUNCTION public.save_claim_analysis(p_claim jsonb, p_analysis jsonb, p_outcome jsonb, p_steps jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$ DECLARE cid uuid; s jsonb; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF; INSERT INTO public.claims(user_id, claim_id, serial_number, dealer_id, repair_type, claim_amount, labor_hours, narrative, risk_score, system_decision, ai_result, rule_results, analysis_snapshot, ai_outcome, status) VALUES(auth.uid(), p_claim->>'claim_id', p_claim->>'serial_number', p_claim->>'dealer_id', p_claim->>'repair_type', (p_claim->>'claim_amount')::numeric, (p_claim->>'labor_hours')::numeric, p_claim->>'narrative', (p_analysis->>'risk_score')::integer, p_analysis->>'decision', p_analysis->'nlp', p_analysis->'rules', p_analysis, p_outcome, 'AWAITING_REVIEW') RETURNING id INTO cid; FOR s IN SELECT value FROM jsonb_array_elements(p_steps) LOOP IF s->>'state' = 'complete' THEN INSERT INTO public.audit_events(claim_uuid,user_id,step,payload,created_at) VALUES(cid,auth.uid(),s->>'id',s,(s->>'timestamp')::timestamptz); END IF; END LOOP; RETURN cid; END; $$;
REVOKE ALL ON FUNCTION public.save_claim_analysis(jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_claim_analysis(jsonb,jsonb,jsonb,jsonb) TO authenticated;
CREATE POLICY "own evidence read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'claim-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own evidence upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id::text = (storage.foldername(name))[2] AND c.user_id = auth.uid()));
ALTER TABLE public.claims ADD COLUMN second_reviewer_id uuid REFERENCES public.profiles(id), ADD COLUMN second_decision text, ADD COLUMN second_note text, ADD COLUMN second_decided_at timestamptz;
ALTER TABLE public.claims ADD CONSTRAINT distinct_second_reviewer CHECK (second_reviewer_id IS NULL OR second_reviewer_id <> user_id), ADD CONSTRAINT second_decision_valid CHECK (second_decision IS NULL OR second_decision IN ('APPROVED','INVESTIGATE','REJECTED'));
CREATE POLICY "assigned claims select" ON public.claims FOR SELECT TO authenticated USING (auth.uid() = second_reviewer_id);
CREATE POLICY "assigned claims update" ON public.claims FOR UPDATE TO authenticated USING (auth.uid() = second_reviewer_id) WITH CHECK (auth.uid() = second_reviewer_id);
CREATE POLICY "related audit select" ON public.audit_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.claims c WHERE c.id=claim_uuid AND (c.user_id=auth.uid() OR c.second_reviewer_id=auth.uid())));
ALTER POLICY "own audit insert" ON public.audit_events WITH CHECK (user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id=claim_uuid AND (c.user_id=auth.uid() OR c.second_reviewer_id=auth.uid())));
CREATE FUNCTION public.guard_claim_approval() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE needs_second boolean; actor text; stamp timestamptz:=now(); action text; event_id text; note text;
BEGIN
needs_second := NEW.claim_amount > 50000 OR COALESCE(NEW.risk_score,0)>=60;
IF TG_OP='INSERT' THEN
 IF NEW.human_decision IS NOT NULL OR NEW.second_decision IS NOT NULL OR NEW.second_reviewer_id IS NOT NULL THEN RAISE EXCEPTION 'New claims must await review'; END IF;
 RETURN NEW;
END IF;
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF OLD.human_decision IS NOT NULL AND (to_jsonb(NEW)-ARRAY['second_reviewer_id','second_decision','second_note','second_decided_at','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['second_reviewer_id','second_decision','second_note','second_decided_at','status','updated_at']) THEN RAISE EXCEPTION 'Recorded claim is immutable'; END IF;
IF OLD.second_decision IS NOT NULL THEN RAISE EXCEPTION 'Final approval is immutable'; END IF;
IF auth.uid()=OLD.user_id THEN
 IF NEW.second_decision IS DISTINCT FROM OLD.second_decision OR NEW.second_note IS DISTINCT FROM OLD.second_note OR NEW.second_decided_at IS DISTINCT FROM OLD.second_decided_at THEN RAISE EXCEPTION 'A different reviewer must sign off'; END IF;
 IF NEW.second_reviewer_id IS DISTINCT FROM OLD.second_reviewer_id AND (OLD.status<>'AWAITING_SECOND_APPROVAL' OR OLD.second_reviewer_id IS NOT NULL OR NEW.second_reviewer_id IS NULL) THEN RAISE EXCEPTION 'Reviewer can only be assigned once to pending approval'; END IF;
 IF NEW.human_decision IS DISTINCT FROM OLD.human_decision THEN
  IF OLD.human_decision IS NOT NULL OR NEW.human_decision NOT IN ('APPROVED','INVESTIGATE','REJECTED') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  NEW.decided_at:=stamp;
 END IF;
ELSIF auth.uid()=OLD.second_reviewer_id THEN
 IF OLD.status<>'AWAITING_SECOND_APPROVAL' OR OLD.human_decision<>'APPROVED' OR NOT needs_second THEN RAISE EXCEPTION 'Claim is not awaiting second approval'; END IF;
 IF (to_jsonb(NEW)-ARRAY['second_decision','second_note','second_decided_at','status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['second_decision','second_note','second_decided_at','status','updated_at']) THEN RAISE EXCEPTION 'Only second signoff may change'; END IF;
 IF NEW.second_decision IS NULL OR NEW.second_decision NOT IN ('APPROVED','INVESTIGATE','REJECTED') THEN RAISE EXCEPTION 'Invalid second decision'; END IF;
 IF NEW.second_decision<>'APPROVED' AND length(trim(COALESCE(NEW.second_note,'')))<10 THEN RAISE EXCEPTION 'Written reason required'; END IF;
 NEW.second_decided_at:=stamp;
ELSE RAISE EXCEPTION 'Claim unavailable'; END IF;
NEW.status:=CASE WHEN NEW.second_decision='INVESTIGATE' OR NEW.human_decision='INVESTIGATE' THEN 'UNDER_INVESTIGATION' WHEN NEW.second_decision IS NOT NULL THEN NEW.second_decision WHEN NEW.human_decision='APPROVED' AND needs_second THEN 'AWAITING_SECOND_APPROVAL' WHEN NEW.human_decision IS NOT NULL THEN NEW.human_decision ELSE 'AWAITING_REVIEW' END;
NEW.updated_at:=stamp;
RETURN NEW;
END; $$;
CREATE TRIGGER guard_claim_approval BEFORE INSERT OR UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.guard_claim_approval();
CREATE FUNCTION public.audit_second_approval() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE s jsonb; actor text; BEGIN
SELECT COALESCE(NULLIF(display_name,''),auth.uid()::text) INTO actor FROM public.profiles WHERE id=auth.uid();
IF NEW.second_reviewer_id IS DISTINCT FROM OLD.second_reviewer_id THEN
 s:=jsonb_build_object('id','A7','title','Second Reviewer Assigned','subtitle','Awaiting independent signoff','timestamp',NEW.updated_at,'state','complete','payload',jsonb_build_object('event','reviewer.assigned','reviewer_id',NEW.second_reviewer_id,'assigned_by',auth.uid()));
ELSIF NEW.second_decision IS DISTINCT FROM OLD.second_decision THEN
 s:=jsonb_build_object('id','A8','title','Independent Reviewer Decision','subtitle',NEW.second_decision||' by '||actor,'timestamp',NEW.second_decided_at,'state','complete','payload',jsonb_build_object('event','second.decision','action',NEW.second_decision,'reviewer',actor,'reviewer_id',auth.uid(),'note',NEW.second_note,'final_state',NEW.status));
END IF;
IF s IS NOT NULL THEN INSERT INTO public.audit_events(claim_uuid,user_id,step,payload,created_at) VALUES(NEW.id,auth.uid(),s->>'id',s,NEW.updated_at); END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER audit_second_approval AFTER UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.audit_second_approval();
CREATE FUNCTION public.record_claim_decision(p_id uuid,p_action text,p_note text,p_step jsonb) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE stamp timestamptz:=now(); reviewer_name text; final_status text; BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_action NOT IN ('APPROVED','INVESTIGATE','REJECTED') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
IF p_action<>'APPROVED' AND length(trim(COALESCE(p_note,'')))<10 THEN RAISE EXCEPTION 'Written reason required'; END IF;
SELECT COALESCE(NULLIF(display_name,''),auth.uid()::text) INTO reviewer_name FROM public.profiles WHERE id=auth.uid();
UPDATE public.claims SET human_decision=p_action,reviewer=reviewer_name,decided_at=stamp,updated_at=stamp WHERE id=p_id AND user_id=auth.uid() AND human_decision IS NULL RETURNING status,decided_at INTO final_status,stamp;
IF NOT FOUND THEN RAISE EXCEPTION 'Claim unavailable or already decided'; END IF;
INSERT INTO public.audit_events(claim_uuid,user_id,step,payload,created_at) VALUES(p_id,auth.uid(),'A6',jsonb_build_object('id','A6','title','Human Decision','subtitle',p_action||' by '||reviewer_name,'timestamp',stamp,'state','complete','payload',jsonb_build_object('event','human.decision','action',p_action,'reviewer',reviewer_name,'reviewer_id',auth.uid(),'note',COALESCE(p_note,''),'recorded_at',stamp,'final_state',final_status)),stamp);
RETURN stamp; END; $$;
REVOKE ALL ON FUNCTION public.record_claim_decision(uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_claim_decision(uuid,text,text,jsonb) TO authenticated;
CREATE FUNCTION public.assign_second_reviewer(p_id uuid,p_reviewer uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
UPDATE public.claims SET second_reviewer_id=p_reviewer WHERE id=p_id AND user_id=auth.uid() AND status='AWAITING_SECOND_APPROVAL' AND second_reviewer_id IS NULL;
IF NOT FOUND THEN RAISE EXCEPTION 'Claim unavailable or reviewer already assigned'; END IF; END; $$;
CREATE FUNCTION public.record_second_decision(p_id uuid,p_action text,p_note text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
UPDATE public.claims SET second_decision=p_action,second_note=trim(p_note) WHERE id=p_id AND second_reviewer_id=auth.uid() AND status='AWAITING_SECOND_APPROVAL' AND second_decision IS NULL;
IF NOT FOUND THEN RAISE EXCEPTION 'Claim unavailable or already signed off'; END IF; END; $$;
REVOKE ALL ON FUNCTION public.assign_second_reviewer(uuid,uuid),public.record_second_decision(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_second_reviewer(uuid,uuid),public.record_second_decision(uuid,text,text) TO authenticated;
CREATE POLICY "assigned evidence read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='claim-evidence' AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id::text=(storage.foldername(name))[2] AND c.user_id::text=(storage.foldername(name))[1] AND c.second_reviewer_id=auth.uid()));