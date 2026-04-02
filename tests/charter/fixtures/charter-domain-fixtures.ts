/**
 * Test fixture factories for Charter domain services.
 */
import type {
  CreateCharterRightInput,
  CreateCharterObligationInput,
  CreateCharterEvidenceInput,
  CreateCharterPayoutInput,
  CreateCharterDecisionInput,
  AssignCharterRoleInput,
} from '../../../src/types/charter/types.js';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function makeCreateRightInput(
  overrides?: Partial<CreateCharterRightInput>,
): CreateCharterRightInput {
  return {
    entityId: nextId(),
    rightType: 'license',
    title: `Test Right ${counter}`,
    description: `Description for test right ${counter}`,
    createdBy: nextId(),
    ...overrides,
  };
}

export function makeCreateObligationInput(
  overrides?: Partial<CreateCharterObligationInput>,
): CreateCharterObligationInput {
  return {
    entityId: nextId(),
    obligationType: 'compliance',
    title: `Test Obligation ${counter}`,
    description: `Description for test obligation ${counter}`,
    createdBy: nextId(),
    ...overrides,
  };
}

export function makeCreateEvidenceInput(
  overrides?: Partial<CreateCharterEvidenceInput>,
): CreateCharterEvidenceInput {
  return {
    linkedTable: 'rights',
    linkedId: nextId(),
    evidenceType: 'document',
    title: `Test Evidence ${counter}`,
    createdBy: nextId(),
    ...overrides,
  };
}

export function makeCreatePayoutInput(
  overrides?: Partial<CreateCharterPayoutInput>,
): CreateCharterPayoutInput {
  return {
    entityId: nextId(),
    amount: 1000,
    currency: 'USD',
    createdBy: nextId(),
    ...overrides,
  };
}

export function makeCreateDecisionInput(
  overrides?: Partial<CreateCharterDecisionInput>,
): CreateCharterDecisionInput {
  return {
    linkedTable: 'rights',
    linkedId: nextId(),
    decisionType: 'approval',
    title: `Test Decision ${counter}`,
    createdBy: nextId(),
    ...overrides,
  };
}

export function makeAssignRoleInput(
  overrides?: Partial<AssignCharterRoleInput>,
): AssignCharterRoleInput {
  return {
    userId: nextId(),
    role: 'reviewer',
    assignedBy: nextId(),
    ...overrides,
  };
}

export function resetFixtureCounter(): void {
  counter = 0;
}
