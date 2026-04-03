-- Enable pgvector for embedding storage and similarity search (Eigen knowledge layer)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enable pg_trgm for fuzzy text search (useful for Eigen knowledge retrieval)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
