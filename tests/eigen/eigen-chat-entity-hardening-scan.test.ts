import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

describe('eigen chat entity scope hardening (static audit)', () => {
  it('eigen-chat gates with guardAuth, requireRole, and idempotency', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/eigen-chat/index.ts'), 'utf8');
    expect(src).toMatch(/guardAuth\s*\(/);
    expect(src).toMatch(/requireRole\s*\(/);
    expect(src).toMatch(/requireIdempotencyKey\s*\(/);
    expect(src).toMatch(/idempotencyKey:\s*meta\.idempotencyKey/);
    expect(src).toMatch(/citations_persisted/);
    expect(src).toMatch(/turn_persisted/);
    expect(src).toMatch(/normalizeEntityScopeFromRequest/);
    expect(src).toMatch(/sanitizeEntityLabel/);
    expect(src).toMatch(/persistSessionEntityScope/);
    expect(src).toMatch(/enforceEigenKosCapabilityBundle/);
    expect(src).toMatch(/loadChatMemoryRecallForChat/);
    expect(src).toMatch(/fetchGovernanceContextForChat/);
    expect(src).toMatch(/scope_update/);
    expect(src).toMatch(/readRetrievalQualityFlags/);
    expect(src).toMatch(/fetchOracleSignalsForEntityScope/);
  });

  it('eigen-widget-chat blocks client policy_scope and limits entity resolve to eigenx', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/eigen-widget-chat/index.ts'), 'utf8');
    expect(src).toMatch(/assertNoClientPolicyScopeOverride/);
    expect(src).toMatch(/verifyWidgetSessionToken/);
    expect(src).toMatch(/insertConversationTurn/);
    expect(src).toMatch(/conversation_turn_id/);
    expect(src).toMatch(/stream is not supported on widget chat/);
    expect(src).toMatch(/normalizeEntityScopeFromRequest/);
    expect(src).toMatch(/claims\.mode === 'eigenx'/);
    expect(src).toMatch(/resolveChatEntityScope/);
    expect(src).toMatch(/readWidgetMaxMessageChars/);
  });

  it('shared resolver escapes ilike and validates meg entity ids on lookup', () => {
    const resolver = readFileSync(join(ROOT, 'src/lib/eigen/chat-entity-resolver.ts'), 'utf8');
    const shared = readFileSync(
      join(ROOT, 'supabase/functions/_shared/chat-entity-context.ts'),
      'utf8',
    );
    expect(resolver).toMatch(/escapeIlikePattern/);
    expect(resolver).toMatch(/MIN_ENTITY_RESOLVE_SCORE/);
    expect(resolver).toMatch(/sanitizeEntityLabel/);
    expect(shared).toMatch(/escapeIlikePattern/);
    expect(shared).toMatch(/isValidMegEntityId\(id\)/);
    expect(shared).toMatch(/SIDECAR_SELECT/);
    expect(shared).toMatch(/MAX_MERGE_HOPS/);
    expect(shared).toMatch(/withResolveTimeout/);
    expect(shared).toMatch(/EIGEN_ENTITY_RESOLVE_MAX_HINTS/);
  });

  it('prompt formatter sanitizes fields and caps entity block size', () => {
    const src = readFileSync(join(ROOT, 'src/lib/eigen/chat-entity-context.ts'), 'utf8');
    expect(src).toMatch(/sanitizePromptFieldText/);
    expect(src).toMatch(/MAX_ENTITY_CONTEXT_BLOCK_CHARS/);
  });

  it('retrieve core normalizes entity_scope uuids', () => {
    const src = readFileSync(
      join(ROOT, 'supabase/functions/_shared/eigen-retrieve-core.ts'),
      'utf8',
    );
    expect(src).toMatch(/normalizeEntityScopeIds/);
    expect(src).toMatch(/computeGraphAwareEntityBoost/);
    expect(src).toMatch(/loadMegOneHopNeighborIds/);
  });
});
