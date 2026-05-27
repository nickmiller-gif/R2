import { describe, expect, it } from 'vitest';
import {
  RECALIBRATION_METHOD_BAYESIAN_V1,
  recalibrateForEvidence,
  recalibrateForOutcome,
} from '../../src/lib/oracle/thesis-confidence-recalibration.js';

describe('recalibrateForEvidence', () => {
  it('raises confidence when validation evidence is linked', () => {
    const r = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 80,
      evidenceStrength: 80,
      linkWeight: 1.0,
    });
    expect(r.newConfidence).toBeGreaterThan(50);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.logOddsShift).toBeGreaterThan(0);
    expect(r.method).toBe(RECALIBRATION_METHOD_BAYESIAN_V1);
  });

  it('lowers confidence when contradiction evidence is linked', () => {
    const r = recalibrateForEvidence(50, {
      role: 'contradiction',
      evidenceConfidence: 80,
      evidenceStrength: 80,
      linkWeight: 1.0,
    });
    expect(r.newConfidence).toBeLessThan(50);
    expect(r.delta).toBeLessThan(0);
  });

  it('is a no-op for inspiration role', () => {
    const r = recalibrateForEvidence(73, {
      role: 'inspiration',
      evidenceConfidence: 100,
      evidenceStrength: 100,
      linkWeight: 1.0,
    });
    expect(r.newConfidence).toBe(73);
    expect(r.delta).toBe(0);
    expect(r.logOddsShift).toBe(0);
  });

  it('stays in [0, 100] for the extremes', () => {
    const lifted = recalibrateForEvidence(99, {
      role: 'validation',
      evidenceConfidence: 100,
      evidenceStrength: 100,
      linkWeight: 1,
    });
    expect(lifted.newConfidence).toBeLessThanOrEqual(100);

    const crushed = recalibrateForEvidence(1, {
      role: 'contradiction',
      evidenceConfidence: 100,
      evidenceStrength: 100,
      linkWeight: 1,
    });
    expect(crushed.newConfidence).toBeGreaterThanOrEqual(0);
  });

  it('moves the needle further when evidence is stronger', () => {
    const weak = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 20,
      evidenceStrength: 20,
      linkWeight: 1,
    });
    const strong = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 100,
      evidenceStrength: 100,
      linkWeight: 1,
    });
    expect(strong.newConfidence - 50).toBeGreaterThan(weak.newConfidence - 50);
  });

  it('respects link weight as a multiplier on the shift', () => {
    const light = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 80,
      evidenceStrength: 80,
      linkWeight: 0.25,
    });
    const heavy = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 80,
      evidenceStrength: 80,
      linkWeight: 2.0,
    });
    expect(heavy.delta).toBeGreaterThan(light.delta);
  });

  it('treats invalid evidence inputs as zero contribution', () => {
    const r = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: Number.NaN,
      evidenceStrength: 50,
      linkWeight: 1,
    });
    expect(r.delta).toBe(0);
  });

  it('treats non-positive link weight as a fallback of 1.0', () => {
    const negative = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 50,
      evidenceStrength: 50,
      linkWeight: -1,
    });
    const unit = recalibrateForEvidence(50, {
      role: 'validation',
      evidenceConfidence: 50,
      evidenceStrength: 50,
      linkWeight: 1,
    });
    expect(negative.delta).toBe(unit.delta);
  });
});

describe('recalibrateForOutcome', () => {
  it('raises confidence on a confirmed verdict', () => {
    const r = recalibrateForOutcome(40, { verdict: 'confirmed' });
    expect(r.newConfidence).toBeGreaterThan(40);
    expect(r.delta).toBeGreaterThan(0);
  });

  it('lowers confidence on a refuted verdict', () => {
    const r = recalibrateForOutcome(60, { verdict: 'refuted' });
    expect(r.newConfidence).toBeLessThan(60);
    expect(r.delta).toBeLessThan(0);
  });

  it('raises confidence less on partially_confirmed than confirmed', () => {
    const partial = recalibrateForOutcome(50, { verdict: 'partially_confirmed' });
    const full = recalibrateForOutcome(50, { verdict: 'confirmed' });
    expect(full.delta).toBeGreaterThan(partial.delta);
    expect(partial.delta).toBeGreaterThan(0);
  });

  it('is a no-op for inconclusive or pending verdicts', () => {
    expect(recalibrateForOutcome(72, { verdict: 'inconclusive' }).newConfidence).toBe(72);
    expect(recalibrateForOutcome(72, { verdict: 'pending' }).newConfidence).toBe(72);
  });

  it('scales the shift by outcomeConfidence', () => {
    const certain = recalibrateForOutcome(50, { verdict: 'confirmed', outcomeConfidence: 1.0 });
    const tentative = recalibrateForOutcome(50, { verdict: 'confirmed', outcomeConfidence: 0.25 });
    expect(certain.delta).toBeGreaterThan(tentative.delta);
  });

  it('clamps a malformed prior to the legal range before computing', () => {
    const negative = recalibrateForOutcome(-50, { verdict: 'confirmed' });
    expect(negative.newConfidence).toBeGreaterThanOrEqual(0);
    expect(negative.newConfidence).toBeLessThanOrEqual(100);
  });
});
