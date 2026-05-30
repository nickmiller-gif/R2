import { describe, expect, it } from 'vitest';
import { mapEigenAccessGroupHttpStatus } from '../../supabase/functions/_shared/eigen-access-group-errors.ts';

describe('mapEigenAccessGroupHttpStatus', () => {
  it('maps not-found and conflict cases', () => {
    expect(mapEigenAccessGroupHttpStatus('group not found')).toBe(404);
    expect(mapEigenAccessGroupHttpStatus('cannot modify archived access group')).toBe(409);
    expect(mapEigenAccessGroupHttpStatus('duplicate key value violates unique constraint')).toBe(
      409,
    );
    expect(mapEigenAccessGroupHttpStatus('group_id required')).toBe(400);
    expect(mapEigenAccessGroupHttpStatus('unexpected blowup')).toBe(500);
  });
});
