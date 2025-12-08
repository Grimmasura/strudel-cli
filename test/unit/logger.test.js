/**
 * Logger Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger } from '../../src/core/logger.js';

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    logger = new Logger({ quiet: true }); // Quiet mode for tests
  });

  describe('initialization', () => {
    it('should create a logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.logger).toBeDefined();
    });

    it('should respect verbose option', () => {
      const verboseLogger = new Logger({ verbose: true });
      expect(verboseLogger.logger.level).toBe('debug');
    });

    it('should respect quiet option', () => {
      const quietLogger = new Logger({ quiet: true });
      expect(quietLogger.logger.level).toBe('error');
    });

    it('should default to info level', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.logger.level).toBe('info');
    });
  });

  describe('logging methods', () => {
    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
      expect(() => logger.debug('test message')).not.toThrow();
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
      expect(() => logger.info('test message')).not.toThrow();
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
      expect(() => logger.warn('test message')).not.toThrow();
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
      expect(() => logger.error('test message')).not.toThrow();
    });

    it('should have fatal method', () => {
      expect(typeof logger.fatal).toBe('function');
      expect(() => logger.fatal('test message')).not.toThrow();
    });
  });

  describe('message formatting', () => {
    it('should accept string messages', () => {
      expect(() => logger.info('simple message')).not.toThrow();
    });

    it('should accept object messages', () => {
      expect(() => logger.info({ key: 'value' })).not.toThrow();
    });

    it('should accept multiple arguments', () => {
      expect(() => logger.info('message', { data: 123 }, 'extra')).not.toThrow();
    });
  });
});
