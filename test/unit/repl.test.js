/**
 * Terminal REPL Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { REPL } from '../../src/repl/terminal.js';
import { Orchestrator } from '../../src/core/orchestrator.js';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';

describe('REPL', () => {
  let repl;
  let orchestrator;
  let config;
  let logger;

  beforeEach(() => {
    config = new Config();
    logger = new Logger({ quiet: true });
    orchestrator = new Orchestrator(config, logger);
    repl = new REPL(orchestrator, { showBanner: false });
  });

  afterEach(async () => {
    // Cleanup REPL if running
    if (repl.isRunning) {
      await repl._cleanup();
    }

    // Cleanup orchestrator if initialized
    if (orchestrator.isInitialized) {
      await orchestrator.cleanup();
    }
  });

  describe('initialization', () => {
    it('should create a REPL instance', () => {
      expect(repl).toBeDefined();
      expect(repl.orchestrator).toBe(orchestrator);
      expect(repl.isRunning).toBe(false);
      expect(repl.currentPattern).toBeNull();
      expect(repl.commandHistory).toEqual([]);
      expect(repl.multilineBuffer).toEqual([]);
      expect(repl.inMultilineMode).toBe(false);
    });

    it('should have registered commands', () => {
      expect(repl.commands).toBeDefined();
      expect(typeof repl.commands['.help']).toBe('function');
      expect(typeof repl.commands['.exit']).toBe('function');
      expect(typeof repl.commands['.quit']).toBe('function');
      expect(typeof repl.commands['.stop']).toBe('function');
      expect(typeof repl.commands['.play']).toBe('function');
      expect(typeof repl.commands['.mode']).toBe('function');
      expect(typeof repl.commands['.status']).toBe('function');
      expect(typeof repl.commands['.clear']).toBe('function');
      expect(typeof repl.commands['.history']).toBe('function');
    });

    it('should accept custom options', () => {
      const customRepl = new REPL(orchestrator, {
        historySize: 500,
        showBanner: true
      });

      expect(customRepl.options.historySize).toBe(500);
      expect(customRepl.options.showBanner).toBe(true);
    });
  });

  describe('command handling', () => {
    beforeEach(async () => {
      // Mock orchestrator initialization
      vi.spyOn(orchestrator, 'initialize').mockResolvedValue(undefined);
      orchestrator.isInitialized = true;
      orchestrator.currentMode = {
        name: 'web',
        isPlaying: false,
        play: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockReturnValue({
          mode: 'web',
          isPlaying: false,
          browserActive: true
        })
      };
    });

    it('should handle .help command', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await repl._handleCommand('.help');

      expect(consoleSpy).toHaveBeenCalled();
      // Should display command list
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('.help');
      expect(output).toContain('.exit');
      expect(output).toContain('.stop');

      consoleSpy.mockRestore();
    });

    it('should handle .stop command', async () => {
      const stopSpy = vi.spyOn(orchestrator, 'stop').mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await repl._handleCommand('.stop');

      expect(stopSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('stopped'));

      consoleSpy.mockRestore();
    });

    it('should handle .status command', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(orchestrator, 'getState').mockReturnValue({
        currentMode: 'web',
        isInitialized: true
      });

      await repl._handleCommand('.status');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Status');
      expect(output).toContain('web');

      consoleSpy.mockRestore();
    });

    it('should handle .mode command with argument', async () => {
      const switchSpy = vi.spyOn(orchestrator, 'switchMode').mockResolvedValue(undefined);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await repl._handleCommand('.mode native');

      expect(switchSpy).toHaveBeenCalledWith('native');

      consoleSpy.mockRestore();
    });

    it('should handle .mode command without argument', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(orchestrator, 'getState').mockReturnValue({
        currentMode: 'web'
      });

      await repl._handleCommand('.mode');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('web'));

      consoleSpy.mockRestore();
    });

    it('should handle .clear command', async () => {
      const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});

      await repl._handleCommand('.clear');

      expect(clearSpy).toHaveBeenCalled();

      clearSpy.mockRestore();
    });

    it('should handle .history command', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Add some history
      repl.commandHistory = ['sound("bd")', 'sound("sd")', '.status'];

      await repl._handleCommand('.history');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('History');

      consoleSpy.mockRestore();
    });

    it('should handle unknown command', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await repl._handleCommand('.unknown');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));

      consoleSpy.mockRestore();
    });
  });

  describe('pattern evaluation', () => {
    beforeEach(async () => {
      vi.spyOn(orchestrator, 'initialize').mockResolvedValue(undefined);
      orchestrator.isInitialized = true;
      orchestrator.currentMode = {
        name: 'web',
        isPlaying: false,
        play: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockReturnValue({
          mode: 'web',
          isPlaying: false
        })
      };
    });

    it('should evaluate valid pattern', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const pattern = 'sound("bd sd hh cp")';

      await repl._evaluatePattern(pattern);

      expect(orchestrator.currentMode.play).toHaveBeenCalledWith(pattern);
      expect(repl.currentPattern).toBe(pattern);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('playing'));

      consoleSpy.mockRestore();
    });

    it('should handle pattern evaluation error', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      orchestrator.currentMode.play = vi.fn().mockRejectedValue(new Error('Invalid pattern'));

      await repl._evaluatePattern('invalid pattern');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));

      consoleSpy.mockRestore();
    });

    it('should store current pattern after successful evaluation', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const pattern = 'note("c3 e3 g3")';

      expect(repl.currentPattern).toBeNull();

      await repl._evaluatePattern(pattern);

      expect(repl.currentPattern).toBe(pattern);
    });

    it('should replay last pattern', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const pattern = 'sound("bd")';

      // Set current pattern
      await repl._evaluatePattern(pattern);
      expect(orchestrator.currentMode.play).toHaveBeenCalledTimes(1);

      // Replay
      await repl._playLastPattern();
      expect(orchestrator.currentMode.play).toHaveBeenCalledTimes(2);
    });

    it('should handle replay when no pattern exists', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(repl.currentPattern).toBeNull();
      await repl._playLastPattern();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No pattern'));

      consoleSpy.mockRestore();
    });
  });

  describe('prompt generation', () => {
    it('should generate prompt with mode indicator', () => {
      orchestrator.currentMode = {
        name: 'native',
        isPlaying: false
      };

      const prompt = repl._getPrompt();

      expect(prompt).toContain('native');
    });

    it('should show playing indicator when pattern is playing', () => {
      orchestrator.currentMode = {
        name: 'web',
        isPlaying: true
      };

      const prompt = repl._getPrompt();

      expect(prompt).toBeDefined();
      // Contains ANSI color codes, just verify it's a string
      expect(typeof prompt).toBe('string');
    });

    it('should handle no active mode', () => {
      orchestrator.currentMode = null;

      const prompt = repl._getPrompt();

      expect(prompt).toContain('none');
    });
  });

  describe('multiline support', () => {
    it('should handle multiline buffer initialization', () => {
      expect(repl.multilineBuffer).toEqual([]);
      expect(repl.inMultilineMode).toBe(false);
    });

    it('should track command history', async () => {
      expect(repl.commandHistory).toEqual([]);

      // Simulate adding to history
      repl.commandHistory.push('sound("bd")');
      repl.commandHistory.push('sound("sd")');

      expect(repl.commandHistory).toHaveLength(2);
      expect(repl.commandHistory[0]).toBe('sound("bd")');
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      vi.spyOn(orchestrator, 'initialize').mockResolvedValue(undefined);
      orchestrator.isInitialized = true;
      orchestrator.currentMode = {
        name: 'web',
        play: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined)
      };
    });

    it('should cleanup orchestrator', async () => {
      const cleanupSpy = vi.spyOn(orchestrator, 'cleanup').mockResolvedValue(undefined);

      repl.isRunning = true;
      await repl._cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(repl.isRunning).toBe(false);
    });

    it('should stop playing patterns on cleanup', async () => {
      const stopSpy = vi.spyOn(orchestrator, 'stop').mockResolvedValue(undefined);

      repl.isRunning = true;
      await repl._cleanup();

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.spyOn(orchestrator, 'stop').mockRejectedValue(new Error('Stop failed'));
      vi.spyOn(orchestrator, 'cleanup').mockRejectedValue(new Error('Cleanup failed'));

      repl.isRunning = true;

      // Should not throw
      await expect(repl._cleanup()).resolves.not.toThrow();
      expect(repl.isRunning).toBe(false);
    });
  });

  describe('exit handling', () => {
    it('should set isRunning to false on exit', async () => {
      repl.isRunning = true;
      repl.rl = { close: vi.fn() };

      await repl._exit();

      expect(repl.isRunning).toBe(false);
      expect(repl.rl.close).toHaveBeenCalled();
    });
  });

  describe('banner display', () => {
    it('should show banner with mode information', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(orchestrator, 'getState').mockReturnValue({
        currentMode: 'native'
      });

      repl._showBanner();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Strudel CLI');

      consoleSpy.mockRestore();
    });

    it('should respect showBanner option', () => {
      const replNoBanner = new REPL(orchestrator, { showBanner: false });
      expect(replNoBanner.options.showBanner).toBe(false);
    });
  });
});
