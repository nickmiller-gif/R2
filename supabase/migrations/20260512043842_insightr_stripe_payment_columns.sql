-- Additive columns for Stripe Checkout + webhook reconciliation.

ALTER TABLE public.validation_batches
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

COMMENT ON COLUMN public.validation_batches.payment_status IS 'pending | paid | failed | waived';

ALTER TABLE public.idea_submissions
  ADD COLUMN IF NOT EXISTS meg_entity_id uuid;
;
