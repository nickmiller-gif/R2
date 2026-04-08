-- Standalone Eigen chat sessions with memory linkage

CREATE TABLE eigen_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT,
  entity_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_retrieval_run_id UUID REFERENCES retrieval_runs(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eigen_chat_sessions_owner_id ON eigen_chat_sessions(owner_id);
CREATE INDEX idx_eigen_chat_sessions_created_at ON eigen_chat_sessions(created_at DESC);

ALTER TABLE eigen_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own chat sessions"
  ON eigen_chat_sessions FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own chat sessions"
  ON eigen_chat_sessions FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own chat sessions"
  ON eigen_chat_sessions FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own chat sessions"
  ON eigen_chat_sessions FOR DELETE
  USING (owner_id = auth.uid());
