-- Tighten claim_checks to prevent silent bad inserts
ALTER TABLE public.claim_checks
  ALTER COLUMN verifier_verdict SET NOT NULL,
  ALTER COLUMN verifier_verdict SET DEFAULT 'unsupported',
  ALTER COLUMN verifier_reasoning SET NOT NULL,
  ALTER COLUMN verifier_reasoning SET DEFAULT '',
  ALTER COLUMN verifier_model SET NOT NULL,
  ALTER COLUMN verifier_model SET DEFAULT 'unknown';

-- Backfill any existing NULLs before constraints take effect against future writes
UPDATE public.claim_checks SET verifier_verdict = 'unsupported' WHERE verifier_verdict IS NULL;
UPDATE public.claim_checks SET verifier_reasoning = '' WHERE verifier_reasoning IS NULL;
UPDATE public.claim_checks SET verifier_model = 'unknown' WHERE verifier_model IS NULL;

-- Disallow blank claim_text and constrain verdict / final_status to known values
ALTER TABLE public.claim_checks
  ADD CONSTRAINT claim_checks_claim_text_not_blank
    CHECK (length(btrim(claim_text)) > 0),
  ADD CONSTRAINT claim_checks_verifier_verdict_valid
    CHECK (verifier_verdict IN ('supported','partially_supported','unsupported')),
  ADD CONSTRAINT claim_checks_final_status_valid
    CHECK (final_status IN ('pending','supported','partially_supported','unsupported'));;
