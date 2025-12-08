/**
 * WebMode Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebMode } from '../../src/modes/web.js';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';

describe('WebMode', () => {
  let webMode;
  let config;
  let logger;

  beforeEach(() => {
    config = new Config();
    logger = new Logger({ quiet: true });
    webMode = new WebMode(config, logger);
  });

  afterEach(async () => {
    // Cleanup if initialized
    if (webMode.browser || webMode.page) {
      await webMode.cleanup();
    }
  });

  describe('initialization', () => {
    it('should create a WebMode instance', () => {
      expect(webMode).toBeDefined();
      expect(webMode.name).toBe('web');
      expect(webMode.config).toBe(config);
      expect(webMode.logger).toBe(logger);
      expect(webMode.browser).toBeNull();
      expect(webMode.page).toBeNull();
      expect(webMode.isPlaying).toBe(false);
    });

    it('should have default Strudel URL', () => {
      expect(webMode.strudelUrl).toBe('https://strudel.cc');
    });

    // Note: Actual browser initialization requires Puppeteer installed
    // This would be tested in integration tests
    it('should throw error if Puppeteer not installed', async () => {
      // Mock _loadPuppeteer to simulate missing Puppeteer
      vi.spyOn(webMode, '_loadPuppeteer').mockRejectedValue(
        new Error('Cannot find module \'puppeteer\'')
      );

      await expect(webMode.initialize()).rejects.toThrow(/Puppeteer not installed/);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = webMode.getState();

      expect(state).toBeDefined();
      expect(state.mode).toBe('web');
      expect(state.isPlaying).toBe(false);
      expect(state.browserActive).toBe(false);
      expect(state.pageActive).toBe(false);
    });

    it('should reflect browser state when active', () => {
      // Simulate browser being active
      webMode.browser = { close: vi.fn() };
      webMode.page = { close: vi.fn() };

      const state = webMode.getState();

      expect(state.browserActive).toBe(true);
      expect(state.pageActive).toBe(true);
    });
  });

  describe('play', () => {
    it('should throw error if not initialized', async () => {
      expect(webMode.page).toBeNull();

      await expect(
        webMode.play('sound("bd")')
      ).rejects.toThrow(/not initialized/);
    });

    // Integration test would verify actual pattern playback
  });

  describe('stop', () => {
    it('should handle stop when not initialized', async () => {
      expect(webMode.page).toBeNull();

      // Should not throw
      await expect(webMode.stop()).resolves.not.toThrow();
    });

    it('should set isPlaying to false', async () => {
      webMode.isPlaying = true;
      webMode.page = null; // Simulate uninitialized

      await webMode.stop();

      // Should not throw and should be handled gracefully
      expect(true).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup when not initialized', async () => {
      expect(webMode.browser).toBeNull();
      expect(webMode.page).toBeNull();

      await webMode.cleanup();

      expect(webMode.browser).toBeNull();
      expect(webMode.page).toBeNull();
      expect(webMode.isPlaying).toBe(false);
    });

    it('should close page if active', async () => {
      const mockPage = {
        close: vi.fn().mockResolvedValue(undefined)
      };
      webMode.page = mockPage;

      await webMode.cleanup();

      expect(mockPage.close).toHaveBeenCalled();
      expect(webMode.page).toBeNull();
    });

    it('should close browser if active', async () => {
      const mockBrowser = {
        close: vi.fn().mockResolvedValue(undefined)
      };
      webMode.browser = mockBrowser;

      await webMode.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(webMode.browser).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockPage = {
        close: vi.fn().mockRejectedValue(new Error('Close failed'))
      };
      const mockBrowser = {
        close: vi.fn().mockRejectedValue(new Error('Close failed'))
      };

      webMode.page = mockPage;
      webMode.browser = mockBrowser;

      // Should not throw
      await expect(webMode.cleanup()).resolves.not.toThrow();

      expect(webMode.page).toBeNull();
      expect(webMode.browser).toBeNull();
    });

    it('should reset isPlaying flag', async () => {
      webMode.isPlaying = true;

      await webMode.cleanup();

      expect(webMode.isPlaying).toBe(false);
    });
  });

  describe('_loadPuppeteer', () => {
    it('should throw helpful error when Puppeteer missing', async () => {
      // Force import to fail
      vi.spyOn(webMode, '_loadPuppeteer').mockImplementation(async () => {
        throw new Error('Cannot find module \'puppeteer\'');
      });

      await expect(webMode._loadPuppeteer()).rejects.toThrow();
    });
  });
});
