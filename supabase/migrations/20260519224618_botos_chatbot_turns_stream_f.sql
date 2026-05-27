-- Stream F: chatbot turns & facts captured by the Autonomous OS Capture extension.
-- Eigen-safe (idempotent): CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS before CREATE.

CREATE TABLE IF NOT EXISTS public.botos_chatbot_turns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL,
  host          text NOT NULL,
  source_url    text NOT NULL,
  page_title    text NOT NULL DEFAULT '',
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  text          text NOT NULL,
  turn_index    integer NOT NULL,
  ts            timestamptz NOT NULL DEFAULT now(),
  session_label text NOT NULL DEFAULT 'default',
  adapter_id    text NOT NULL DEFAULT 'generic',
  prior_turns   jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (session_id, turn_index, role)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_turns_session ON public.botos_chatbot_turns (session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_chatbot_turns_host_ts ON public.botos_chatbot_turns (host, ts DESC);

ALTER TABLE public.botos_chatbot_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "botos_chatbot_turns_select_anon" ON public.botos_chatbot_turns;
CREATE POLICY "botos_chatbot_turns_select_anon"
  ON public.botos_chatbot_turns FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "botos_chatbot_turns_select_authenticated" ON public.botos_chatbot_turns;
CREATE POLICY "botos_chatbot_turns_select_authenticated"
  ON public.botos_chatbot_turns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "botos_chatbot_turns_all_service" ON public.botos_chatbot_turns;
CREATE POLICY "botos_chatbot_turns_all_service"
  ON public.botos_chatbot_turns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.botos_chatbot_facts (
  id                     text PRIMARY KEY,
  session_id             text NOT NULL,
  host                   text NOT NULL,
  kind                   text NOT NULL CHECK (kind IN ('personal', 'domain')),
  subject                text NOT NULL DEFAULT '',
  predicate              text NOT NULL DEFAULT '',
  value                  text NOT NULL DEFAULT '',
  confidence             real NOT NULL DEFAULT 0.5,
  evidence_turn_indices  integer[] NOT NULL DEFAULT '{}',
  ts                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_facts_session ON public.botos_chatbot_facts (session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_facts_host_kind ON public.botos_chatbot_facts (host, kind);

ALTER TABLE public.botos_chatbot_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "botos_chatbot_facts_select_anon" ON public.botos_chatbot_facts;
CREATE POLICY "botos_chatbot_facts_select_anon"
  ON public.botos_chatbot_facts FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "botos_chatbot_facts_select_authenticated" ON public.botos_chatbot_facts;
CREATE POLICY "botos_chatbot_facts_select_authenticated"
  ON public.botos_chatbot_facts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "botos_chatbot_facts_all_service" ON public.botos_chatbot_facts;
CREATE POLICY "botos_chatbot_facts_all_service"
  ON public.botos_chatbot_facts FOR ALL TO service_role USING (true) WITH CHECK (true);;
