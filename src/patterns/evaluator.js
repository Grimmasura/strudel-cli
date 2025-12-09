/**
 * PatternEvaluator - Secure sandbox for Strudel pattern evaluation
 *
 * Uses vm2 to execute pattern code in an isolated environment with a restricted
 * scope. Provides basic pattern helpers for early alpha without exposing Node
 * built-ins or require/process access.
 *
 * @module patterns/evaluator
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { VM } from 'vm2';

export class PatternEvaluationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PatternEvaluationError';
  }
}

/**
 * Create a minimal "pattern" object that supports fluent chaining.
 * This is a lightweight placeholder until full @strudel/core integration.
 */
const createPatternFactory = (name) => {
  const factory = (...args) => {
    const pattern = {
      name,
      args,
      chain: []
    };

    const chainable = (method) => (...methodArgs) => {
      pattern.chain.push({ method, args: methodArgs });
      return pattern;
    };

    pattern.s = chainable('s');
    pattern.fast = chainable('fast');
    pattern.stack = chainable('stack');
    pattern.slow = chainable('slow');

    return pattern;
  };

  return factory;
};

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
   */
  constructor(audioContext, logger, scopeOverrides = {}, timeoutMs = 5000) {
    this.audioContext = audioContext;
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.scope = this._buildScope(scopeOverrides);
    this.vm = new VM({
      timeout: this.timeoutMs,
      sandbox: this.scope,
      eval: false,
      wasm: false,
      allowAsync: false,
      wrapper: 'none'
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
      const result = this.vm.run(trimmed);
      this.logger?.debug?.('Pattern evaluated in sandbox');
      return result;
    } catch (error) {
      const sanitized = this._sanitizeError(error);
      throw new PatternEvaluationError(sanitized);
    }
  }

  /**
   * Stop current execution (no-op placeholder for streaming schedulers).
   */
  async stop() {
    // Placeholder for future scheduling control
  }

  /**
   * Cleanup resources.
   */
  async cleanup() {
    // No external resources to clean for vm2
  }

  _buildScope(overrides) {
    const patternFns = {
      note: createPatternFactory('note'),
      sound: createPatternFactory('sound'),
      s: createPatternFactory('s')
    };

    const safeScope = {
      Math,
      console: createSafeConsole(this.logger),
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
      ...patternFns,
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
