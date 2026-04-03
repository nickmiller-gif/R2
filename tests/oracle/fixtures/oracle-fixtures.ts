/**
 * Test fixture factories for Oracle services.
 */
import type { CreateOracleProfileRunInput } from '../../../src/types/oracle/profile-run.js';

let counter = 0;

export function nextOracleFixtureId(): string {
  counter += 1;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function resetOracleFixtureCounter(): void {
  counter = 0;
}

export function makeCreateOracleProfileRunInput(
  overrides?: Partial<CreateOracleProfileRunInput>,
): CreateOracleProfileRunInput {
  return {
    entityAssetId: nextOracleFixtureId(),
    triggeredBy: 'oracle-scheduler-v1',
    ...overrides,
  };
}
