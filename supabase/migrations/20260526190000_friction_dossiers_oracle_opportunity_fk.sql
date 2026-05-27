-- Restore the FK from friction_dossiers.oracle_opportunity_id to
-- oracle_opportunities(id) once both tables exist. The original inline FK in
-- 20260516143000_friction_zero_phase0.sql was removed so that file can run
-- against a clean database without depending on the later truth-market
-- migration that creates oracle_opportunities. Production already has the FK
-- in place (the original migration applied it inline), so this DO block is
-- a no-op there.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
       AND kcu.constraint_schema = rc.constraint_schema
     WHERE rc.constraint_schema = 'public'
       AND kcu.table_name = 'friction_dossiers'
       AND kcu.column_name = 'oracle_opportunity_id'
  ) THEN
    ALTER TABLE public.friction_dossiers
      ADD CONSTRAINT friction_dossiers_oracle_opportunity_id_fkey
      FOREIGN KEY (oracle_opportunity_id)
      REFERENCES public.oracle_opportunities(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
