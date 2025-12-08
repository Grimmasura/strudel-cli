/**
 * Orchestrator Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Orchestrator } from '../../src/core/orchestrator.js';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Orchestrator', () => {
  let orchestrator;
  let config;
  let logger;
  let testConfigDir;

  beforeEach(() => {
    // Create temporary config directory
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strudel-cli-test-'));
    process.env.XDG_CONFIG_HOME = testConfigDir;

    config = new Config();
    logger = new Logger({ quiet: true });
    orchestrator = new Orchestrator(config, logger);
  });

  afterEach(async () => {
    // Cleanup orchestrator
    if (orchestrator.isInitialized) {
      await orchestrator.cleanup();
    }

    // Clean up test directory
    if (testConfigDir && fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create an orchestrator instance', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.config).toBe(config);
      expect(orchestrator.logger).toBe(logger);
      expect(orchestrator.currentMode).toBeNull();
      expect(orchestrator.isInitialized).toBe(false);
    });

    it('should initialize with default mode', async () => {
      await orchestrator.initialize();

      expect(orchestrator.isInitialized).toBe(true);
      expect(orchestrator.currentMode).toBeDefined();
      expect(orchestrator.currentMode.name).toBeDefined();
    });

    it('should initialize with specified mode', async () => {
      await orchestrator.initialize({ mode: 'web' });

      expect(orchestrator.isInitialized).toBe(true);
      expect(orchestrator.currentMode.name).toBe('web');
    });

    it('should not re-initialize if already initialized', async () => {
      await orchestrator.initialize();
      const firstMode = orchestrator.currentMode;

      await orchestrator.initialize(); // Second call

      expect(orchestrator.currentMode).toBe(firstMode);
    });
  });

  describe('selectMode', () => {
    it('should select web mode', async () => {
      const mode = await orchestrator.selectMode('web');

      expect(mode).toBeDefined();
      expect(mode.name).toBe('web');
    });

    it('should select native mode', async () => {
      const mode = await orchestrator.selectMode('native');

      expect(mode).toBeDefined();
      expect(mode.name).toBe('native');
    });

    it('should select osc mode', async () => {
      const mode = await orchestrator.selectMode('osc');

      expect(mode).toBeDefined();
      expect(mode.name).toBe('osc');
    });

    it('should auto-detect mode when "auto" specified', async () => {
      const mode = await orchestrator.selectMode('auto');

      expect(mode).toBeDefined();
      expect(['web', 'native', 'osc']).toContain(mode.name);
    });

    it('should fallback to web mode for unknown mode', async () => {
      const mode = await orchestrator.selectMode('invalid-mode');

      expect(mode).toBeDefined();
      expect(mode.name).toBe('web');
    });
  });

  describe('getState', () => {
    it('should return current state when not initialized', () => {
      const state = orchestrator.getState();

      expect(state.isInitialized).toBe(false);
      expect(state.currentMode).toBeNull();
      expect(state.config).toBeDefined();
    });

    it('should return current state when initialized', async () => {
      await orchestrator.initialize({ mode: 'web' });
      const state = orchestrator.getState();

      expect(state.isInitialized).toBe(true);
      expect(state.currentMode).toBe('web');
      expect(state.config).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup successfully', async () => {
      await orchestrator.initialize();
      expect(orchestrator.isInitialized).toBe(true);

      await orchestrator.cleanup();

      expect(orchestrator.isInitialized).toBe(false);
      expect(orchestrator.currentMode).toBeNull();
    });

    it('should handle cleanup when not initialized', async () => {
      expect(orchestrator.isInitialized).toBe(false);

      await orchestrator.cleanup(); // Should not throw

      expect(orchestrator.isInitialized).toBe(false);
    });
  });

  describe('switchMode', () => {
    it('should switch between modes', async () => {
      await orchestrator.initialize({ mode: 'web' });
      expect(orchestrator.currentMode.name).toBe('web');

      await orchestrator.switchMode('native');

      expect(orchestrator.currentMode.name).toBe('native');
      expect(orchestrator.isInitialized).toBe(true);
    });

    it('should cleanup old mode when switching', async () => {
      await orchestrator.initialize({ mode: 'web' });
      const oldMode = orchestrator.currentMode;

      // Spy on cleanup
      const cleanupSpy = vi.spyOn(oldMode, 'cleanup');

      await orchestrator.switchMode('native');

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop playback when mode is active', async () => {
      await orchestrator.initialize({ mode: 'web' });

      // Should not throw even if stop() is not implemented
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });

    it('should handle stop when no mode is active', async () => {
      expect(orchestrator.currentMode).toBeNull();

      await expect(orchestrator.stop()).resolves.not.toThrow();
    });
  });

  describe('play', () => {
    it('should throw error for non-existent file', async () => {
      await expect(
        orchestrator.play('/non/existent/file.js')
      ).rejects.toThrow();
    });

    it('should initialize orchestrator if not initialized', async () => {
      expect(orchestrator.isInitialized).toBe(false);

      // Create a temporary pattern file
      const tempFile = path.join(testConfigDir, 'test-pattern.js');
      fs.writeFileSync(tempFile, 'sound("bd").fast(2)');

      try {
        await orchestrator.play(tempFile);
      } catch (error) {
        // Expected to fail since modes aren't fully implemented
        // But orchestrator should be initialized
        expect(orchestrator.isInitialized).toBe(true);
      }
    });
  });

  describe('startREPL', () => {
    it('should throw error when REPL not implemented', async () => {
      await expect(orchestrator.startREPL()).rejects.toThrow(
        /REPL functionality coming in next phase/
      );
    });

    it('should initialize orchestrator before starting REPL', async () => {
      expect(orchestrator.isInitialized).toBe(false);

      try {
        await orchestrator.startREPL();
      } catch (error) {
        // Expected to fail, but should have initialized
        expect(orchestrator.isInitialized).toBe(true);
      }
    });
  });
});
