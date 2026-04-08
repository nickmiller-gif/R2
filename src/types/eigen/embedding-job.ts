/**
 * EigenX Embedding Job — types for the pgmq embedding pipeline.
 */

/** Payload enqueued by the knowledge_chunks trigger. */
export interface EmbeddingJobPayload {
  chunk_id: string;
  document_id: string;
  content_hash: string;
  chunk_level: string;
  op: 'INSERT' | 'UPDATE';
}

/** A pgmq message wrapping the job payload. */
export interface PgmqMessage<T = EmbeddingJobPayload> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: T;
}

/** Batch payload sent by the pg_cron dispatcher to the Edge Function. */
export interface EmbeddingBatchRequest {
  messages: PgmqMessage<EmbeddingJobPayload>[];
}

/** Result of processing a single embedding job. */
export interface EmbeddingJobResult {
  chunk_id: string;
  status: 'embedded' | 'skipped' | 'failed';
  error?: string;
}
