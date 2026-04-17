-- Entity Graph Layer for Oracle White Space Discovery
-- Adds entity mention extraction and relation tracking on top of
-- knowledge_chunks and asset_registry, enabling GraphRAG-style
-- gap topology and narrative discovery.
--
-- Depends on: knowledge_chunks, asset_registry, oracle_whitespace_runs

-- ─── Entity mention type ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE entity_mention_type AS ENUM (
    'direct',          -- Explicitly named in text
    'inferred',        -- Resolved via coreference or context
    'alias_matched'    -- Matched via known alias/synonym
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Entity Mentions (chunk → entity links) ──────────────────────────
-- Connects knowledge_chunks to canonical entities in asset_registry.
-- Populated during ingestion (entity extraction on ingest) or
-- batch re-processing of existing corpus.

CREATE TABLE IF NOT EXISTS entity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES asset_registry(id) ON DELETE CASCADE,

  mention_text text NOT NULL,   -- The surface form found in the chunk
  mention_type entity_mention_type NOT NULL DEFAULT 'direct',
  confidence numeric(4,3) NOT NULL DEFAULT 0.800
    CHECK (confidence >= 0 AND confidence <= 1),

  -- Character offsets within the chunk content (optional, for highlighting)
  start_offset int,
  end_offset int,

  -- Provenance
  extracted_by text NOT NULL DEFAULT 'eigen-ingest',  -- service that created this
  extraction_model text,                                -- e.g. 'gpt-4o-mini-ner'

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_em_chunk_id ON entity_mentions (chunk_id);
CREATE INDEX IF NOT EXISTS idx_em_entity_id ON entity_mentions (entity_id);
CREATE INDEX IF NOT EXISTS idx_em_entity_chunk ON entity_mentions (entity_id, chunk_id);
CREATE INDEX IF NOT EXISTS idx_em_mention_type ON entity_mentions (mention_type);
CREATE INDEX IF NOT EXISTS idx_em_confidence ON entity_mentions (confidence DESC);

-- Prevent duplicate mentions of the same entity in the same chunk at the same offset
CREATE UNIQUE INDEX IF NOT EXISTS idx_em_unique_mention
  ON entity_mentions (chunk_id, entity_id, COALESCE(start_offset, -1));

ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_em ON entity_mentions;
CREATE POLICY select_em ON entity_mentions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM knowledge_chunks kc
      JOIN documents d ON d.id = kc.document_id
      WHERE kc.id = entity_mentions.chunk_id
        AND d.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.charter_user_roles cur
      WHERE cur.user_id = auth.uid()
        AND cur.role::text IN ('operator', 'counsel', 'admin')
    )
  );

DROP POLICY IF EXISTS insert_em ON entity_mentions;
CREATE POLICY insert_em ON entity_mentions
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS delete_em ON entity_mentions;
CREATE POLICY delete_em ON entity_mentions
  FOR DELETE TO service_role
  USING (true);


-- ─── Relation type enum ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE entity_relation_type AS ENUM (
    -- Structural
    'related_to',
    'part_of',
    'instance_of',

    -- Domain: IP & market
    'competes_with',
    'derives_from',
    'licensed_by',
    'targets_market',
    'disrupts',

    -- Domain: health & supplement
    'treats',
    'interacts_with',
    'formulated_with',
    'clinical_trial_for',

    -- Domain: property & real estate
    'located_in',
    'comparable_to',
    'zoned_as',

    -- Domain: seller & commerce
    'sold_by',
    'supplied_by',
    'priced_against',

    -- Temporal
    'precedes',
    'succeeds',
    'trending_with'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Entity Relations (knowledge graph edges) ────────────────────────
-- Typed, weighted edges between entities. Built from entity co-occurrence
-- in chunks, explicit extraction, or community detection.

CREATE TABLE IF NOT EXISTS entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id uuid NOT NULL REFERENCES asset_registry(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES asset_registry(id) ON DELETE CASCADE,
  relation_type entity_relation_type NOT NULL,

  -- Strength and provenance
  weight numeric(4,3) NOT NULL DEFAULT 0.500
    CHECK (weight >= 0 AND weight <= 1),
  evidence_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  evidence_count int NOT NULL DEFAULT 1,

  -- Discovery context
  discovered_in_run_id uuid REFERENCES oracle_whitespace_runs(id) ON DELETE SET NULL,
  discovered_by text NOT NULL DEFAULT 'co-occurrence',  -- co-occurrence | extraction | manual
  extraction_model text,

  -- Metadata
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- No self-loops, no duplicate typed edges
  CONSTRAINT no_self_loop CHECK (source_entity_id != target_entity_id),
  CONSTRAINT unique_typed_relation UNIQUE (source_entity_id, target_entity_id, relation_type)
);

-- Graph traversal indexes
CREATE INDEX IF NOT EXISTS idx_er_source ON entity_relations (source_entity_id);
CREATE INDEX IF NOT EXISTS idx_er_target ON entity_relations (target_entity_id);
CREATE INDEX IF NOT EXISTS idx_er_type ON entity_relations (relation_type);
CREATE INDEX IF NOT EXISTS idx_er_weight ON entity_relations (weight DESC);
CREATE INDEX IF NOT EXISTS idx_er_run ON entity_relations (discovered_in_run_id) WHERE discovered_in_run_id IS NOT NULL;

-- Reverse lookup for bidirectional traversal
CREATE INDEX IF NOT EXISTS idx_er_target_source ON entity_relations (target_entity_id, source_entity_id);

ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_er ON entity_relations;
CREATE POLICY select_er ON entity_relations
  FOR SELECT TO authenticated
  USING (
    discovered_in_run_id IS NULL
    OR EXISTS (
      SELECT 1 FROM oracle_whitespace_runs owr
      WHERE owr.id = entity_relations.discovered_in_run_id
        AND (
          owr.created_by = auth.uid()
          OR owr.status::text = 'published'
          OR EXISTS (
            SELECT 1 FROM public.charter_user_roles cur
            WHERE cur.user_id = auth.uid()
              AND cur.role::text IN ('operator', 'counsel', 'admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS insert_er ON entity_relations;
CREATE POLICY insert_er ON entity_relations
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS update_er ON entity_relations;
CREATE POLICY update_er ON entity_relations
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS delete_er ON entity_relations;
CREATE POLICY delete_er ON entity_relations
  FOR DELETE TO service_role
  USING (true);


-- ─── Updated-at trigger for entity_relations ─────────────────────────
DROP TRIGGER IF EXISTS set_updated_at_er ON entity_relations;
CREATE TRIGGER set_updated_at_er
  BEFORE UPDATE ON entity_relations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── Utility: entity neighborhood function ───────────────────────────
-- Returns 1-hop neighbors for a given entity (for graph traversal in runs)
CREATE OR REPLACE FUNCTION entity_neighborhood(
  p_entity_id uuid,
  p_max_depth int DEFAULT 1,
  p_min_weight numeric DEFAULT 0.3
)
RETURNS TABLE (
  entity_id uuid,
  relation_type entity_relation_type,
  weight numeric,
  direction text
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE walk AS (
    SELECT
      er.target_entity_id AS entity_id,
      er.relation_type,
      er.weight,
      'outgoing'::text AS direction,
      1 AS depth,
      ARRAY[p_entity_id, er.target_entity_id]::uuid[] AS visited
    FROM entity_relations er
    WHERE er.source_entity_id = p_entity_id
      AND er.weight >= p_min_weight

    UNION ALL

    SELECT
      er.source_entity_id AS entity_id,
      er.relation_type,
      er.weight,
      'incoming'::text AS direction,
      1 AS depth,
      ARRAY[p_entity_id, er.source_entity_id]::uuid[] AS visited
    FROM entity_relations er
    WHERE er.target_entity_id = p_entity_id
      AND er.weight >= p_min_weight

    UNION ALL

    SELECT
      CASE
        WHEN er.source_entity_id = walk.entity_id THEN er.target_entity_id
        ELSE er.source_entity_id
      END AS entity_id,
      er.relation_type,
      er.weight,
      CASE
        WHEN er.source_entity_id = walk.entity_id THEN 'outgoing'::text
        ELSE 'incoming'::text
      END AS direction,
      walk.depth + 1 AS depth,
      walk.visited || CASE
        WHEN er.source_entity_id = walk.entity_id THEN er.target_entity_id
        ELSE er.source_entity_id
      END AS visited
    FROM walk
    JOIN entity_relations er
      ON er.source_entity_id = walk.entity_id
      OR er.target_entity_id = walk.entity_id
    WHERE walk.depth < GREATEST(p_max_depth, 1)
      AND er.weight >= p_min_weight
      AND (
        CASE
          WHEN er.source_entity_id = walk.entity_id THEN er.target_entity_id
          ELSE er.source_entity_id
        END
      ) <> ALL(walk.visited)
  )
  SELECT DISTINCT
    walk.entity_id,
    walk.relation_type,
    walk.weight,
    walk.direction
  FROM walk;
$$;

COMMENT ON TABLE entity_mentions IS
  'Links knowledge chunks to canonical entities in asset_registry via NER extraction.';
COMMENT ON TABLE entity_relations IS
  'Typed, weighted edges between entities forming the Oracle knowledge graph.';
COMMENT ON FUNCTION entity_neighborhood IS
  'Returns up to p_max_depth hops of entity neighbors with relation type and direction for graph traversal.';
