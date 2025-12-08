/**
 * Config Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config } from '../../src/core/config.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Config', () => {
  let testConfigDir;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temporary config directory
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strudel-cli-test-'));
    process.env.XDG_CONFIG_HOME = testConfigDir;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up test directory
    if (testConfigDir && fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('getDefaults', () => {
    it('should return default configuration', () => {
      const config = new Config();
      const defaults = config.getDefaults();

      expect(defaults).toBeDefined();
      expect(defaults.mode).toBe('auto');
      expect(defaults.audio.backend).toBe('auto');
      expect(defaults.audio.sampleRate).toBe(48000);
      expect(defaults.audio.bufferSize).toBe(256);
    });

    it('should respect environment variables', () => {
      process.env.STRUDEL_MODE = 'native';
      process.env.STRUDEL_AUDIO_BACKEND = 'jack';

      const config = new Config();
      const defaults = config.getDefaults();

      expect(defaults.mode).toBe('native');
      expect(defaults.audio.backend).toBe('jack');
    });
  });

  describe('get/set', () => {
    it('should get and set values', () => {
      const config = new Config();

      config.set('audio.backend', 'alsa');
      expect(config.get('audio.backend')).toBe('alsa');

      config.set('audio.sampleRate', 44100);
      expect(config.get('audio.sampleRate')).toBe(44100);
    });

    it('should handle nested keys', () => {
      const config = new Config();

      config.set('samples.localPath', '/custom/path');
      expect(config.get('samples.localPath')).toBe('/custom/path');
    });

    it('should return undefined for non-existent keys', () => {
      const config = new Config();

      expect(config.get('nonexistent.key')).toBeUndefined();
    });
  });

  describe('load', () => {
    it('should create a Config instance', async () => {
      const config = await Config.load();

      expect(config).toBeInstanceOf(Config);
      expect(config.get('mode')).toBeDefined();
    });
  });

  describe('offline mode', () => {
    it('should respect STRUDEL_OFFLINE environment variable', () => {
      process.env.STRUDEL_OFFLINE = 'true';

      const config = new Config();
      const defaults = config.getDefaults();

      expect(defaults.offline).toBe(true);
    });

    it('should default to false when not set', () => {
      delete process.env.STRUDEL_OFFLINE;

      const config = new Config();
      const defaults = config.getDefaults();

      expect(defaults.offline).toBe(false);
    });
  });
});
