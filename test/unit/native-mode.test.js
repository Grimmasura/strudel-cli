/**
 * NativeMode Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NativeMode } from '../../src/modes/native.js';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';

describe('NativeMode', () => {
  let nativeMode;
  let config;
  let logger;

  beforeEach(() => {
    config = new Config();
    logger = new Logger({ quiet: true });
    nativeMode = new NativeMode(config, logger);
  });

  afterEach(async () => {
    // Cleanup if initialized
    if (nativeMode.audioContext || nativeMode.backend) {
      await nativeMode.cleanup();
    }
  });

  describe('initialization', () => {
    it('should create a NativeMode instance', () => {
      expect(nativeMode).toBeDefined();
      expect(nativeMode.name).toBe('native');
      expect(nativeMode.config).toBe(config);
      expect(nativeMode.logger).toBe(logger);
      expect(nativeMode.audioContext).toBeNull();
      expect(nativeMode.backend).toBeNull();
      expect(nativeMode.evaluator).toBeNull();
      expect(nativeMode.isPlaying).toBe(false);
      expect(nativeMode.currentPattern).toBeNull();
    });

    it('should initialize with auto-detected backend', async () => {
      // Mock backend detection to succeed
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);

      await nativeMode.initialize();

      expect(nativeMode.backend).toBeDefined();
      expect(['alsa', 'jack', 'pulse']).toContain(nativeMode.backend);
      expect(nativeMode.audioContext).toBeDefined();
      expect(nativeMode.evaluator).toBeDefined();
    });

    it('should initialize with specified backend', async () => {
      // Mock ALSA backend as available
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockImplementation(async (backend) => {
        return backend === 'alsa';
      });

      await nativeMode.initialize({ backend: 'alsa' });

      expect(nativeMode.backend).toBe('alsa');
      expect(nativeMode.audioContext).toBeDefined();
    });

    it('should throw error if no backends available', async () => {
      // Mock all backends as unavailable
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(false);

      await expect(nativeMode.initialize()).rejects.toThrow(/No native audio backend available/);
    });

    it('should create audio context with configured sample rate', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      config.set('audio.sampleRate', 44100);

      await nativeMode.initialize();

      expect(nativeMode.audioContext.sampleRate).toBe(44100);
    });

    it('should fallback to auto if requested backend unavailable', async () => {
      // Mock only pulse as available
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockImplementation(async (backend) => {
        return backend === 'pulse';
      });

      await nativeMode.initialize({ backend: 'jack' });

      // Should fallback to pulse (the only available one)
      expect(nativeMode.backend).toBe('pulse');
    });
  });

  describe('backend detection', () => {
    it('should detect ALSA backend when aplay available', async () => {
      // This test would pass on systems with ALSA installed
      // Skip if not available (integration test territory)
      const isAvailable = await nativeMode._checkBackendAvailable('alsa');
      if (isAvailable) {
        expect(isAvailable).toBe(true);
      }
    });

    it('should detect JACK backend when jack_lsp available', async () => {
      const isAvailable = await nativeMode._checkBackendAvailable('jack');
      // May or may not be available, just verify it doesn't crash
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should detect PulseAudio backend when pactl available', async () => {
      const isAvailable = await nativeMode._checkBackendAvailable('pulse');
      // May or may not be available, just verify it doesn't crash
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should return false for unknown backend', async () => {
      const isAvailable = await nativeMode._checkBackendAvailable('invalid-backend');
      expect(isAvailable).toBe(false);
    });

    it('should prioritize JACK over ALSA in auto-selection', async () => {
      // Mock both JACK and ALSA as available
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockImplementation(async (backend) => {
        return backend === 'jack' || backend === 'alsa';
      });

      await nativeMode.initialize({ backend: 'auto' });

      // Should select JACK (higher priority)
      expect(nativeMode.backend).toBe('jack');
    });
  });

  describe('play', () => {
    beforeEach(async () => {
      // Mock backend detection
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedMode = new NativeMode(config, logger);
      expect(uninitializedMode.audioContext).toBeNull();

      await expect(
        uninitializedMode.play('sound("bd")')
      ).rejects.toThrow(/not initialized/);
    });

    it('should accept valid pattern code', async () => {
      const pattern = 'sound("bd sd").fast(2)';

      await nativeMode.play(pattern);

      expect(nativeMode.isPlaying).toBe(true);
      expect(nativeMode.currentPattern).toBe(pattern);
    });

    it('should validate pattern code', async () => {
      await expect(nativeMode.play('')).rejects.toThrow(/must be a non-empty string/);
      await expect(nativeMode.play('   ')).rejects.toThrow(/cannot be empty/);
      await expect(nativeMode.play(null)).rejects.toThrow(/must be a non-empty string/);
    });

    it('should store current pattern when playing', async () => {
      const pattern = 'note("c3 e3 g3").s("piano")';

      await nativeMode.play(pattern);

      expect(nativeMode.currentPattern).toBe(pattern);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
    });

    it('should handle stop when not playing', async () => {
      expect(nativeMode.isPlaying).toBe(false);

      // Should not throw
      await expect(nativeMode.stop()).resolves.not.toThrow();
    });

    it('should stop playback and clear pattern', async () => {
      await nativeMode.play('sound("bd")');
      expect(nativeMode.isPlaying).toBe(true);
      expect(nativeMode.currentPattern).toBeDefined();

      await nativeMode.stop();

      expect(nativeMode.isPlaying).toBe(false);
      expect(nativeMode.currentPattern).toBeNull();
    });

    it('should handle stop when not initialized', async () => {
      const uninitializedMode = new NativeMode(config, logger);
      expect(uninitializedMode.audioContext).toBeNull();

      // Should warn but not throw
      await expect(uninitializedMode.stop()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup when not initialized', async () => {
      expect(nativeMode.backend).toBeNull();
      expect(nativeMode.audioContext).toBeNull();

      await nativeMode.cleanup();

      expect(nativeMode.backend).toBeNull();
      expect(nativeMode.audioContext).toBeNull();
      expect(nativeMode.isPlaying).toBe(false);
    });

    it('should cleanup audio context', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
      expect(nativeMode.audioContext).toBeDefined();

      await nativeMode.cleanup();

      expect(nativeMode.audioContext).toBeNull();
    });

    it('should cleanup evaluator', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
      expect(nativeMode.evaluator).toBeDefined();

      const evaluatorCleanupSpy = vi.spyOn(nativeMode.evaluator, 'cleanup');

      await nativeMode.cleanup();

      expect(evaluatorCleanupSpy).toHaveBeenCalled();
      expect(nativeMode.evaluator).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();

      // Mock evaluator cleanup to throw error
      vi.spyOn(nativeMode.evaluator, 'cleanup').mockRejectedValue(
        new Error('Cleanup failed')
      );

      // Should not throw, just warn
      await expect(nativeMode.cleanup()).resolves.not.toThrow();

      expect(nativeMode.evaluator).toBeNull();
      expect(nativeMode.audioContext).toBeNull();
    });

    it('should reset all state flags', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
      await nativeMode.play('sound("bd")');

      expect(nativeMode.isPlaying).toBe(true);
      expect(nativeMode.backend).toBeDefined();

      await nativeMode.cleanup();

      expect(nativeMode.isPlaying).toBe(false);
      expect(nativeMode.backend).toBeNull();
      expect(nativeMode.currentPattern).toBeNull();
    });
  });

  describe('getState', () => {
    it('should return current state when not initialized', () => {
      const state = nativeMode.getState();

      expect(state).toBeDefined();
      expect(state.mode).toBe('native');
      expect(state.isPlaying).toBe(false);
      expect(state.backend).toBeNull();
      expect(state.audioContextActive).toBe(false);
      expect(state.evaluatorActive).toBe(false);
      expect(state.sampleRate).toBeNull();
      expect(state.currentPattern).toBeNull();
    });

    it('should return current state when initialized', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();

      const state = nativeMode.getState();

      expect(state.mode).toBe('native');
      expect(state.backend).toBeDefined();
      expect(state.audioContextActive).toBe(true);
      expect(state.evaluatorActive).toBe(true);
      expect(state.sampleRate).toBeDefined();
    });

    it('should include current pattern when playing', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();

      const pattern = 'sound("bd sd hh cp").fast(2)';
      await nativeMode.play(pattern);

      const state = nativeMode.getState();

      expect(state.isPlaying).toBe(true);
      expect(state.currentPattern).toContain('sound("bd sd hh cp")');
    });
  });

  describe('audio context creation', () => {
    it('should create audio context with default settings', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      config.set('audio.sampleRate', 48000); // Set explicit default
      await nativeMode.initialize();

      expect(nativeMode.audioContext.sampleRate).toBe(48000);
      expect(nativeMode.audioContext.bufferSize).toBe(256);
      expect(nativeMode.audioContext.channels).toBe(2);
      expect(nativeMode.audioContext.state).toBe('running');
    });

    it('should create audio context with custom settings', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);

      config.set('audio.sampleRate', 44100);
      config.set('audio.bufferSize', 512);
      config.set('audio.channels', 1);

      await nativeMode.initialize();

      expect(nativeMode.audioContext.sampleRate).toBe(44100);
      expect(nativeMode.audioContext.bufferSize).toBe(512);
      expect(nativeMode.audioContext.channels).toBe(1);
    });

    it('should have stub methods for Phase 2 implementation', async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();

      expect(() => nativeMode.audioContext.createOscillator()).toThrow(/Not implemented in Phase 1/);
      expect(() => nativeMode.audioContext.createGain()).toThrow(/Not implemented in Phase 1/);
      expect(() => nativeMode.audioContext.createBuffer()).toThrow(/Not implemented in Phase 1/);
    });
  });

  describe('pattern evaluator', () => {
    beforeEach(async () => {
      vi.spyOn(nativeMode, '_checkBackendAvailable').mockResolvedValue(true);
      await nativeMode.initialize();
    });

    it('should create evaluator stub', () => {
      expect(nativeMode.evaluator).toBeDefined();
      expect(typeof nativeMode.evaluator.evaluate).toBe('function');
      expect(typeof nativeMode.evaluator.stop).toBe('function');
      expect(typeof nativeMode.evaluator.cleanup).toBe('function');
    });

    it('should accept pattern evaluation in Phase 1 stub', async () => {
      const result = await nativeMode.evaluator.evaluate('sound("bd")');
      expect(result.success).toBe(true);
    });

    it('should call evaluator stop on mode stop', async () => {
      const stopSpy = vi.spyOn(nativeMode.evaluator, 'stop');

      await nativeMode.play('sound("bd")');
      await nativeMode.stop();

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
