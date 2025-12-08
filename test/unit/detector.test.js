/**
 * Detector Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { Detector } from '../../src/core/detector.js';

describe('Detector', () => {
  describe('detectAudioBackends', () => {
    it('should return an array of available backends', async () => {
      const backends = await Detector.detectAudioBackends();

      expect(Array.isArray(backends)).toBe(true);

      // On Linux, should detect at least one backend
      if (process.platform === 'linux') {
        expect(backends.length).toBeGreaterThan(0);
      }

      // All backends should be valid strings
      backends.forEach(backend => {
        expect(['alsa', 'jack', 'pulse']).toContain(backend);
      });
    });
  });

  describe('detectOptimalMode', () => {
    it('should recommend a valid mode', async () => {
      const mode = await Detector.detectOptimalMode();

      expect(['native', 'web', 'osc']).toContain(mode);
    });

    it('should prefer native mode if backends available', async () => {
      const backends = await Detector.detectAudioBackends();
      const mode = await Detector.detectOptimalMode();

      if (backends.length > 0) {
        expect(mode).toBe('native');
      } else {
        expect(mode).toBe('web');
      }
    });
  });

  describe('getSystemInfo', () => {
    it('should return system information', async () => {
      const info = await Detector.getSystemInfo();

      expect(info).toBeDefined();
      expect(info.platform).toBeDefined();
      expect(info.arch).toBeDefined();
      expect(info.nodeVersion).toBeDefined();
      expect(Array.isArray(info.availableBackends)).toBe(true);
      expect(info.recommendedMode).toBeDefined();
    });

    it('should include valid platform', async () => {
      const info = await Detector.getSystemInfo();

      expect(['linux', 'darwin', 'win32']).toContain(info.platform);
    });

    it('should include valid architecture', async () => {
      const info = await Detector.getSystemInfo();

      expect(['x64', 'arm64', 'arm', 'ia32']).toContain(info.arch);
    });

    it('should match process properties', async () => {
      const info = await Detector.getSystemInfo();

      expect(info.platform).toBe(process.platform);
      expect(info.arch).toBe(process.arch);
      expect(info.nodeVersion).toBe(process.version);
    });
  });
});
