"""Run with python3 -m unittest discover -s tests; inspects deployed security rules."""
import json
import subprocess
import unittest

def query(sql):
    result = subprocess.run(['lovable', 'supabase', 'query', sql, '--json'], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)

class ReviewerSecurityTests(unittest.TestCase):
    def test_profiles_are_owner_only(self):
        result = query("SELECT count(*) AS count FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND qual LIKE '%auth.uid()%id%'")
        self.assertIn('2', str(result))

    def test_saved_claim_operations_are_not_anonymous(self):
        result = query("SELECT bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')) AS secure, count(*) AS functions FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('save_claim_analysis','record_claim_decision')")
        self.assertIn('true', json.dumps(result))
        self.assertIn('2', str(result))

    def test_audit_insert_requires_claim_ownership(self):
        result = query("SELECT with_check FROM pg_policies WHERE schemaname='public' AND tablename='audit_events' AND cmd='INSERT'")
        self.assertIn('c.user_id = auth.uid()', str(result))

    def test_signup_creates_reviewer_profile(self):
        result = query("SELECT count(*) AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='users' AND t.tgname='create_reviewer_profile' AND t.tgenabled='O'")
        self.assertIn('1', str(result))

    def test_independent_signoff_is_authenticated_and_invoker(self):
        result = query("SELECT count(*) AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('assign_second_reviewer','record_second_decision') AND NOT p.prosecdef AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')")
        self.assertIn('2', str(result))

    def test_second_reviewer_cannot_be_the_owner(self):
        result = query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='distinct_second_reviewer' AND conrelid='public.claims'::regclass")
        self.assertIn('second_reviewer_id <> user_id', str(result))

    def test_assigned_evidence_access_is_claim_scoped(self):
        result = query("SELECT qual FROM pg_policies WHERE schemaname='storage' AND policyname='assigned evidence read'")
        self.assertIn('c.second_reviewer_id = auth.uid()', str(result))
        self.assertIn('claim-evidence', str(result))

    def test_database_amount_and_risk_gates(self):
        # Rolled-back isolated database check, not a real authenticated UI session.
        query("""BEGIN;
        SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
        SET LOCAL ROLE authenticated;
        DO $$ DECLARE cid uuid; state text; amount integer; score integer;
        BEGIN
          FOR amount,score IN SELECT * FROM (VALUES (50001,0),(450,60),(50000,59)) v(a,r) LOOP
            INSERT INTO public.claims(user_id,claim_id,serial_number,dealer_id,repair_type,claim_amount,risk_score)
            VALUES(auth.uid(),'ROLLBACK-CHECK','TEST','TEST','Seal Replacement',amount,score) RETURNING id INTO cid;
            PERFORM public.record_claim_decision(cid,'APPROVED','', '{}'::jsonb);
            SELECT status INTO state FROM public.claims WHERE id=cid;
            IF state IS DISTINCT FROM CASE WHEN amount>50000 OR score>=60 THEN 'AWAITING_SECOND_APPROVAL' ELSE 'APPROVED' END THEN RAISE EXCEPTION 'Approval gate failed'; END IF;
            BEGIN
              PERFORM public.record_claim_decision(cid,'REJECTED','second decision not allowed','{}'::jsonb);
              RAISE EXCEPTION 'Duplicate decision was accepted';
            EXCEPTION WHEN raise_exception THEN
              IF SQLERRM='Duplicate decision was accepted' THEN RAISE; END IF;
            END;
          END LOOP;
        END $$;
        ROLLBACK;""")

if __name__ == '__main__':
    unittest.main()