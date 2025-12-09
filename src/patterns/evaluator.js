/**
 * PatternEvaluator - Secure sandbox for Strudel pattern evaluation
 *
 * Uses vm2 to execute pattern code in an isolated environment with a restricted
 * scope. Provides Strudel core/mini helpers while blocking Node built-ins.
 *
 * @module patterns/evaluator
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { VM } from 'vm2';
import * as strudel from '@strudel/core';
import { mini, m, h } from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';
import { registerLanguage } from '@strudel/transpiler';
import { getLeafLocations } from '@strudel/mini';

export class PatternEvaluationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PatternEvaluationError';
  }
}

const createSafeConsole = (logger) => ({
  log: (...args) => logger?.debug?.(args.join(' ')),
  warn: (...args) => logger?.warn?.(args.join(' ')),
  error: (...args) => logger?.error?.(args.join(' ')),
  info: (...args) => logger?.info?.(args.join(' '))
});

export class PatternEvaluator {
  /**
   * @param {object} audioContext - Audio context reference (informational)
   * @param {Logger} logger - Logger instance
   * @param {object} scopeOverrides - Additional scope bindings
   * @param {number} timeoutMs - Execution timeout in ms
   * @param {Function} onPattern - Callback when a pattern is produced
   * @param {object} audioEngine - Optional audio engine for scheduling
   */
  constructor(audioContext, logger, scopeOverrides = {}, timeoutMs = 5000, onPattern = null, audioEngine = null) {
    this.audioContext = audioContext;
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.onPattern = onPattern;
    this.audioEngine = audioEngine;
    this.scope = this._buildScope(scopeOverrides);
    this.vm = new VM({
      timeout: this.timeoutMs,
      sandbox: this.scope,
      eval: false,
      wasm: false,
      allowAsync: true,
      wrapper: 'none'
    });

    // Register mini language once for transpiler
    registerLanguage('minilang', {
      getLocations: (code, offset) => getLeafLocations(`"${code}"`, offset, code)
    });
  }

  /**
   * Evaluate pattern code within the sandbox.
   * @param {string} code - Pattern source code
   * @returns {Promise<*>} Evaluation result (pattern object or expression result)
   */
  async evaluate(code) {
    if (typeof code !== 'string') {
      throw new PatternEvaluationError('Pattern code must be a string');
    }

    const trimmed = code.trim();
    if (trimmed.length === 0) {
      throw new PatternEvaluationError('Pattern code cannot be empty');
    }

    try {
      const transpiled = transpiler(trimmed, { addReturn: true, wrapAsync: false });
      const wrapped = `(async () => { ${transpiled.output} })()`;
      const pattern = await this.vm.run(wrapped);
      if (!strudel.isPattern(pattern)) {
        throw new Error('Evaluation did not return a Strudel Pattern');
      }
      this.logger?.debug?.('Pattern evaluated in sandbox');
      if (this.onPattern) {
        await this.onPattern(pattern);
      }
      if (this.audioEngine && pattern) {
        await this.audioEngine.setPattern(pattern);
      }
      return pattern;
    } catch (error) {
      const sanitized = this._sanitizeError(error);
      throw new PatternEvaluationError(sanitized);
    }
  }

  /**
   * Stop current execution (no-op placeholder for streaming schedulers).
   */
  async stop() {
    if (this.audioEngine) {
      await this.audioEngine.stop();
    }
  }

  /**
   * Cleanup resources.
   */
  async cleanup() {
    // No external resources to clean for vm2
    this.audioEngine = null;
  }

  _buildScope(overrides) {
    const safeScope = {
      Math,
      console: createSafeConsole(this.logger),
      // Expose Strudel helpers
      strudel,
      note: strudel.note,
      sound: strudel.sound,
      s: strudel.s,
      stack: strudel.stack,
      seq: strudel.seq,
      hush: strudel.silence,
      mini,
      m,
      h,
      isPattern: strudel.isPattern,
      // Explicitly block dangerous globals
      require: undefined,
      process: undefined,
      fs: undefined,
      child_process: undefined,
      global: undefined,
      globalThis: undefined,
      module: undefined,
      Buffer: undefined,
      setImmediate: undefined,
      setInterval: undefined,
      setTimeout: undefined,
      ...overrides
    };

    return safeScope;
  }

  _sanitizeError(error) {
    if (!error) {
      return 'Unknown pattern evaluation error';
    }

    // Prefer error message without stack to avoid leaking internals
    if (error.message) {
      return error.message;
    }

    return String(error);
  }
}
