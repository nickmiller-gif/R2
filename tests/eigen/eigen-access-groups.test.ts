import { describe, expect, it } from 'vitest';
import {
  buildMemberRetrievePolicyScope,
  clampMemberExplicitPolicyScope,
  isPersonalUploadSourceSystem,
  normalizePersonalUploadPolicyTags,
  policyTagEigenxGroup,
  policyTagEigenxUser,
} from '../../src/lib/eigen/eigen-access-groups.ts';

const USER = '11111111-1111-1111-1111-111111111111';
const GROUP_A = '22222222-2222-2222-2222-222222222222';
const GROUP_B = '33333333-3333-3333-3333-333333333333';

describe('buildMemberRetrievePolicyScope', () => {
  it('includes personal and group tags', () => {
    const scope = buildMemberRetrievePolicyScope(USER, [GROUP_A, GROUP_B]);
    expect(scope).toContain(policyTagEigenxUser(USER));
    expect(scope).toContain(policyTagEigenxGroup(GROUP_A));
    expect(scope).toContain(policyTagEigenxGroup(GROUP_B));
  });
});

describe('clampMemberExplicitPolicyScope', () => {
  it('allows only personal and member group tags', () => {
    const out = clampMemberExplicitPolicyScope(
      USER,
      [GROUP_A],
      ['eigenx', policyTagEigenxGroup(GROUP_B), policyTagEigenxUser(USER)],
    );
    expect(out).toContain(policyTagEigenxUser(USER));
    expect(out).not.toContain('eigenx');
    expect(out).not.toContain(policyTagEigenxGroup(GROUP_B));
  });

  it('falls back to default member scope when nothing allowed', () => {
    const out = clampMemberExplicitPolicyScope(USER, [GROUP_A], ['eigenx']);
    expect(out).toEqual(buildMemberRetrievePolicyScope(USER, [GROUP_A]));
  });
});

describe('normalizePersonalUploadPolicyTags', () => {
  it('uses personal tag not org-wide eigenx', () => {
    const out = normalizePersonalUploadPolicyTags(['eigenx'], USER);
    expect(out).toContain(policyTagEigenxUser(USER));
    expect(out).not.toContain('eigenx');
    expect(out).toContain('user_upload');
  });

  it('adds group tag when sharing with group', () => {
    const out = normalizePersonalUploadPolicyTags([], USER, GROUP_A);
    expect(out).toContain(policyTagEigenxGroup(GROUP_A));
  });
});

describe('isPersonalUploadSourceSystem', () => {
  it('detects manual uploads', () => {
    expect(isPersonalUploadSourceSystem('manual-upload')).toBe(true);
    expect(isPersonalUploadSourceSystem('centralr2-core')).toBe(false);
  });
});
