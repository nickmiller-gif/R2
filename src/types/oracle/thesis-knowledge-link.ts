/**
 * Oracle → Eigen bridge — links Oracle theses to Eigen knowledge chunks.
 *
 * When an Oracle thesis reaches a publishable state, its insights are
 * distilled into Eigen knowledge chunks. This link table tracks which
 * thesis produced which chunk, with a relationship type and confidence.
 *
 * This is the critical wiring that closes Gap #2 in the intelligence loop.
 */

export type ThesisKnowledgeLinkType =
  | 'generated'    // Thesis generated this chunk
  | 'validated'    // Thesis validated existing chunk
  | 'contradicted' // Thesis contradicted existing chunk
  | 'refined';     // Thesis refined/updated existing chunk

export type ThesisKnowledgeLinkStatus = 'active' | 'superseded' | 'retracted';

export interface ThesisKnowledgeLink {
  id: string;
  thesisId: string;
  knowledgeChunkId: string;
  linkType: ThesisKnowledgeLinkType;
  status: ThesisKnowledgeLinkStatus;
  confidence: number;
  distillationNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateThesisKnowledgeLinkInput {
  thesisId: string;
  knowledgeChunkId: string;
  linkType: ThesisKnowledgeLinkType;
  confidence?: number;
  distillationNotes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateThesisKnowledgeLinkInput {
  status?: ThesisKnowledgeLinkStatus;
  confidence?: number;
  distillationNotes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ThesisKnowledgeLinkFilter {
  thesisId?: string;
  knowledgeChunkId?: string;
  linkType?: ThesisKnowledgeLinkType;
  status?: ThesisKnowledgeLinkStatus;
}
