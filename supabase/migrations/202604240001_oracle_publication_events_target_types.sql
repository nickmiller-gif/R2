-- Add workflow audit labels used by operator supersede/rescore flows.
-- Keep schema changes additive by extending enum values in place.
ALTER TYPE public.oracle_publication_state ADD VALUE IF NOT EXISTS 'superseded';
ALTER TYPE public.oracle_publication_state ADD VALUE IF NOT EXISTS 'successor_of';
