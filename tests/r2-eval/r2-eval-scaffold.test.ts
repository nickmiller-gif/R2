import { describe, expect, it } from 'vitest';
import { R2_EVAL_VERSION } from '../../packages/r2-eval/src/index.ts';

describe('@r2/eval scaffold', () => {
  it('exports a version sentinel', () => {
    expect(R2_EVAL_VERSION).toContain('scaffold');
  });
});
