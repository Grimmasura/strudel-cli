/**
 * Sample Server Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SampleServer } from '../../src/samples/server.js';
import { SampleCache } from '../../src/samples/cache.js';
import { SampleDownloader } from '../../src/samples/downloader.js';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('SampleServer', () => {
  let server;
  let config;
  let logger;
  let testCacheDir;

  beforeEach(() => {
    // Create temporary cache directory
    testCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strudel-samples-test-'));

    config = new Config();
    config.set('samples.localPath', testCacheDir);
    config.set('samples.serverPort', 0); // Random port for testing

    logger = new Logger({ quiet: true });
    server = new SampleServer(config, logger);
  });

  afterEach(async () => {
    // Stop server if running
    if (server.isRunning) {
      await server.stop();
    }

    // Clean up test directory
    if (testCacheDir) {
      try {
        await fs.rm(testCacheDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('initialization', () => {
    it('should create a SampleServer instance', () => {
      expect(server).toBeDefined();
      expect(server.config).toBe(config);
      expect(server.logger).toBe(logger);
      expect(server.isRunning).toBe(false);
      expect(server.server).toBeNull();
    });

    it('should have configured samples directory', () => {
      expect(server.samplesDir).toBeDefined();
      expect(typeof server.samplesDir).toBe('string');
    });

    it('should have default port', () => {
      expect(server.port).toBeDefined();
      expect(typeof server.port).toBe('number');
    });
  });

  describe('start and stop', () => {
    it('should start server on specified port', async () => {
      await server.start({ port: 0 }); // Random port

      expect(server.isRunning).toBe(true);
      expect(server.server).toBeDefined();
      expect(server.port).toBeGreaterThan(0);
    });

    it('should not start if already running', async () => {
      await server.start({ port: 0 });
      expect(server.isRunning).toBe(true);

      const warnSpy = vi.spyOn(server.logger, 'warn');
      await server.start();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));
    });

    it('should stop running server', async () => {
      await server.start({ port: 0 });
      expect(server.isRunning).toBe(true);

      await server.stop();

      expect(server.isRunning).toBe(false);
    });

    it('should not stop if not running', async () => {
      expect(server.isRunning).toBe(false);

      const warnSpy = vi.spyOn(server.logger, 'warn');
      await server.stop();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not running'));
    });
  });

  describe('content type detection', () => {
    it('should detect WAV content type', () => {
      const contentType = server._getContentType('sample.wav');
      expect(contentType).toBe('audio/wav');
    });

    it('should detect MP3 content type', () => {
      const contentType = server._getContentType('sample.mp3');
      expect(contentType).toBe('audio/mpeg');
    });

    it('should detect OGG content type', () => {
      const contentType = server._getContentType('sample.ogg');
      expect(contentType).toBe('audio/ogg');
    });

    it('should detect JSON content type', () => {
      const contentType = server._getContentType('manifest.json');
      expect(contentType).toBe('application/json');
    });

    it('should return default for unknown types', () => {
      const contentType = server._getContentType('unknown.xyz');
      expect(contentType).toBe('application/octet-stream');
    });

    it('should handle case-insensitive extensions', () => {
      const contentType = server._getContentType('SAMPLE.WAV');
      expect(contentType).toBe('audio/wav');
    });
  });

  describe('getState', () => {
    it('should return current state when not running', () => {
      const state = server.getState();

      expect(state.isRunning).toBe(false);
      expect(state.port).toBeDefined();
      expect(state.samplesDir).toBeDefined();
      expect(state.url).toBeNull();
    });

    it('should return current state when running', async () => {
      await server.start({ port: 0 });
      const state = server.getState();

      expect(state.isRunning).toBe(true);
      expect(state.port).toBeGreaterThan(0);
      expect(state.url).toContain('http://localhost:');
    });
  });

  describe('getURL', () => {
    it('should return null when not running', () => {
      expect(server.getURL()).toBeNull();
    });

    it('should return URL when running', async () => {
      await server.start({ port: 0 });
      const url = server.getURL();

      expect(url).toBeDefined();
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    });
  });
});

describe('SampleCache', () => {
  let cache;
  let config;
  let logger;
  let testCacheDir;

  beforeEach(async () => {
    testCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strudel-cache-test-'));

    config = new Config();
    logger = new Logger({ quiet: true });

    // Override cache directory for testing
    cache = new SampleCache(config, logger);
    cache.cacheDir = testCacheDir;
  });

  afterEach(async () => {
    if (testCacheDir) {
      try {
        await fs.rm(testCacheDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('initialization', () => {
    it('should create a SampleCache instance', () => {
      expect(cache).toBeDefined();
      expect(cache.config).toBe(config);
      expect(cache.logger).toBe(logger);
      expect(cache.maxSizeMB).toBe(1000); // Default
    });

    it('should initialize cache', async () => {
      await cache.initialize();

      expect(cache.manifest).toBeDefined();
      expect(cache.manifest.version).toBe('1.0.0');
      expect(cache.manifest.samples).toBeDefined();
    });

    it('should create cache directory on init', async () => {
      await cache.initialize();

      const exists = await fs.access(cache.cacheDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('cache operations', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should check if sample is cached', async () => {
      expect(await cache.isCached('test.wav')).toBe(false);

      // Add sample
      await cache.addSample('test.wav', Buffer.from('test data'));

      expect(await cache.isCached('test.wav')).toBe(true);
    });

    it('should add sample to cache', async () => {
      const data = Buffer.from('sample audio data');
      const cachedPath = await cache.addSample('drums/kick.wav', data);

      expect(cachedPath).toBeDefined();
      expect(await cache.isCached('drums/kick.wav')).toBe(true);

      // Verify manifest updated
      expect(cache.manifest.samples['drums/kick.wav']).toBeDefined();
      expect(cache.manifest.samples['drums/kick.wav'].size).toBe(data.length);
    });

    it('should get cached sample path', async () => {
      await cache.addSample('test.wav', Buffer.from('data'));

      const cachedPath = cache.getCachedPath('test.wav');
      expect(cachedPath).toBeDefined();
      expect(cachedPath).toContain('test.wav');
    });

    it('should return null for non-cached sample', () => {
      const cachedPath = cache.getCachedPath('nonexistent.wav');
      expect(cachedPath).toBeNull();
    });

    it('should remove sample from cache', async () => {
      await cache.addSample('test.wav', Buffer.from('data'));
      expect(await cache.isCached('test.wav')).toBe(true);

      await cache.removeSample('test.wav');

      expect(await cache.isCached('test.wav')).toBe(false);
      expect(cache.manifest.samples['test.wav']).toBeUndefined();
    });

    it('should update access time', async () => {
      await cache.addSample('test.wav', Buffer.from('data'));

      const originalAccessTime = cache.manifest.samples['test.wav'].lastAccessed;

      // Wait a bit and update
      await new Promise(resolve => setTimeout(resolve, 10));
      await cache.updateAccessTime('test.wav');

      const newAccessTime = cache.manifest.samples['test.wav'].lastAccessed;
      expect(newAccessTime).not.toBe(originalAccessTime);
    });
  });

  describe('cache statistics', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should get cache stats', async () => {
      const stats = await cache.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalSamples).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.maxSizeMB).toBe(cache.maxSizeMB);
      expect(stats.cacheDir).toBe(cache.cacheDir);
    });

    it('should calculate stats correctly', async () => {
      await cache.addSample('sample1.wav', Buffer.from('a'.repeat(1000)));
      await cache.addSample('sample2.wav', Buffer.from('b'.repeat(2000)));

      const stats = await cache.getStats();

      expect(stats.totalSamples).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(parseFloat(stats.totalSizeMB)).toBeGreaterThan(0);
    });
  });

  describe('cache cleanup', () => {
    beforeEach(async () => {
      await cache.initialize();
    });

    it('should clear entire cache', async () => {
      await cache.addSample('sample1.wav', Buffer.from('data1'));
      await cache.addSample('sample2.wav', Buffer.from('data2'));

      let stats = await cache.getStats();
      expect(stats.totalSamples).toBe(2);

      await cache.clear();

      stats = await cache.getStats();
      expect(stats.totalSamples).toBe(0);
    });
  });
});

describe('SampleDownloader', () => {
  let downloader;
  let cache;
  let config;
  let logger;

  beforeEach(async () => {
    config = new Config();
    logger = new Logger({ quiet: true });
    cache = new SampleCache(config, logger);

    // Use temporary cache directory
    cache.cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strudel-download-test-'));
    await cache.initialize();

    downloader = new SampleDownloader(config, logger, cache);
  });

  afterEach(async () => {
    if (cache.cacheDir) {
      try {
        await fs.rm(cache.cacheDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('initialization', () => {
    it('should create a SampleDownloader instance', () => {
      expect(downloader).toBeDefined();
      expect(downloader.config).toBe(config);
      expect(downloader.logger).toBe(logger);
      expect(downloader.cache).toBe(cache);
      expect(downloader.autoDownload).toBe(false);
    });
  });

  describe('pack management', () => {
    it('should list available packs', async () => {
      const packs = await downloader.listAvailablePacks();

      expect(Array.isArray(packs)).toBe(true);
      expect(packs.length).toBeGreaterThan(0);
      expect(packs[0]).toHaveProperty('name');
      expect(packs[0]).toHaveProperty('description');
      expect(packs[0]).toHaveProperty('url');
    });

    it('should check if pack is installed', async () => {
      const isInstalled = await downloader.isPackInstalled('nonexistent-pack');
      expect(isInstalled).toBe(false);
    });

    it('should throw error for pack download (Phase 1 stub)', async () => {
      await expect(
        downloader.downloadPack('https://example.com/pack.zip')
      ).rejects.toThrow(/not yet implemented/);
    });
  });

  describe('getState', () => {
    it('should return downloader state', () => {
      const state = downloader.getState();

      expect(state).toBeDefined();
      expect(state.autoDownload).toBe(false);
      expect(state.cacheDir).toBeDefined();
    });
  });
});
