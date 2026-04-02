// Shape matches R2's planned schema
// Oracle signal shape matches OracleSignal type in R2/src/types (to be published as npm package)

export type FounderProfile = { id: string; email: string; name: string };

export type IdeaSubmission = {
  id: string;
  founderId: string;
  title: string;
  problemStatement: string;
  targetUser: string;       // one-sentence profile
  stage: 'idea' | 'landing-page' | 'prototype' | 'mvp';
  prototypeUrl?: string;
  successCriterion: string; // what would "yes" look like?
  createdAt: string;
  status: 'pending' | 'in_progress' | 'complete';
};

export type ValidationBatch = {
  id: string;
  ideaId: string;
  packageTier: 'starter' | 'standard';  // 5 interviews vs 10
  priceUsdCents: number;
  interviewsTotal: number;
  interviewsComplete: number;
  slaDeadline: string;       // ISO datetime
  researcherName?: string;
  createdAt: string;
};

export type OracleSignal = {
  id: string;
  batchId: string;
  score: number;             // 0-100
  confidence: 'low' | 'medium' | 'high';
  recommendation: 'pursue' | 'pivot' | 'drop';
  topReasons: string[];      // max 3
  topObjections: string[];
  topDesires: string[];
  willingnessToPay: 'none' | 'low' | 'medium' | 'high';
  createdAt: string;
};
