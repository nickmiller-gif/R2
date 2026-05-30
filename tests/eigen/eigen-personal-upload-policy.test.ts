import { describe, expect, it } from 'vitest';
import {
  applyPersonalUploadPolicyTags,
  policyTagEigenxUser,
} from '../../supabase/functions/_shared/eigen-policy.ts';

describe('applyPersonalUploadPolicyTags', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  it('adds eigenx:user tag for manual uploads', () => {
    const out = applyPersonalUploadPolicyTags(['eigenx', 'user_upload'], userId, 'manual-upload');
    expect(out).toContain(policyTagEigenxUser(userId));
  });

  it('does not duplicate personal tag', () => {
    const personal = policyTagEigenxUser(userId);
    const out = applyPersonalUploadPolicyTags(['eigenx', personal], userId, 'manual-upload');
    expect(out.filter((t) => t === personal)).toHaveLength(1);
  });

  it('leaves pipeline source systems unchanged', () => {
    const out = applyPersonalUploadPolicyTags(['eigenx'], userId, 'centralr2-core');
    expect(out).toEqual(['eigenx']);
  });
});
