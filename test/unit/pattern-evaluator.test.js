/**
 * PatternEvaluator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as strudel from '@strudel/core';
import { PatternEvaluator, PatternEvaluationError } from '../../src/patterns/evaluator.js';

const makeLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
});

describe('PatternEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new PatternEvaluator(null, makeLogger(), {}, 1000);
  });

  it('evaluates simple pattern code', async () => {
    const result = await evaluator.evaluate('note("c3 e3 g3").s("sine")');

    expect(strudel.isPattern(result)).toBe(true);
  });

  it('evaluates mini helper', async () => {
    const result = await evaluator.evaluate('mini("bd sd")');
    expect(strudel.isPattern(result)).toBe(true);
  });

  it('blocks require access', async () => {
    await expect(evaluator.evaluate('require("fs")')).rejects.toThrow(PatternEvaluationError);
  });

  it('blocks process access', async () => {
    await expect(evaluator.evaluate('process.exit()')).rejects.toThrow(PatternEvaluationError);
  });

  it('enforces timeout', async () => {
    await expect(evaluator.evaluate('while(true) {}')).rejects.toThrow(PatternEvaluationError);
  });

  it('rejects empty code', async () => {
    await expect(evaluator.evaluate('   ')).rejects.toThrow(/cannot be empty/i);
  });
});
