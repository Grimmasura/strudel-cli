/**
 * Sample Cache - Intelligent caching for audio samples
 *
 * Manages local sample cache with size limits and cleanup strategies.
 * Phase 1 MVP: Basic cache management with size tracking.
 *
 * @module samples/cache
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

export class SampleCache {
  /**
   * Create a SampleCache instance
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cacheDir = this._resolveCacheDir();
    this.maxSizeMB = config.get('samples.cacheSizeMB') || 1000;
    this.manifest = null;
  }

  /**
   * Initialize cache
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.debug('Initializing sample cache...');

    // Ensure cache directory exists
    await this._ensureCacheDir();

    // Load or create manifest
    await this._loadManifest();

    this.logger.info(`Sample cache initialized: ${this.cacheDir}`);
    this.logger.debug(`Cache size limit: ${this.maxSizeMB}MB`);
  }

  /**
   * Check if sample is cached
   * @param {string} samplePath - Sample path (relative)
   * @returns {Promise<boolean>} True if cached
   */
  async isCached(samplePath) {
    const cachedPath = path.join(this.cacheDir, samplePath);
    return existsSync(cachedPath);
  }

  /**
   * Get cached sample path
   * @param {string} samplePath - Sample path (relative)
   * @returns {string|null} Absolute path to cached sample, or null if not cached
   */
  getCachedPath(samplePath) {
    const cachedPath = path.join(this.cacheDir, samplePath);
    return existsSync(cachedPath) ? cachedPath : null;
  }

  /**
   * Add sample to cache
   * @param {string} samplePath - Sample path (relative)
   * @param {Buffer|string} data - Sample data
   * @returns {Promise<string>} Absolute path to cached sample
   */
  async addSample(samplePath, data) {
    const cachedPath = path.join(this.cacheDir, samplePath);

    // Ensure directory exists
    const dir = path.dirname(cachedPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Write sample to cache
    await fs.writeFile(cachedPath, data);

    // Update manifest
    const stats = await fs.stat(cachedPath);
    const now = new Date().toISOString();
    this.manifest.samples[samplePath] = {
      size: stats.size,
      hash: this._hashBuffer(data),
      cachedAt: now,
      lastAccessed: now
    };

    await this._saveManifest();

    // Check cache size and cleanup if needed
    await this._checkCacheSize();

    this.logger.debug(`Sample cached: ${samplePath} (${stats.size} bytes)`);

    return cachedPath;
  }

  /**
   * Remove sample from cache
   * @param {string} samplePath - Sample path (relative)
   * @returns {Promise<void>}
   */
  async removeSample(samplePath) {
    const cachedPath = path.join(this.cacheDir, samplePath);

    if (existsSync(cachedPath)) {
      await fs.unlink(cachedPath);
      delete this.manifest.samples[samplePath];
      // Remove URL mappings that pointed here
      if (this.manifest.urls) {
        for (const [url, mappedPath] of Object.entries(this.manifest.urls)) {
          if (mappedPath === samplePath) {
            delete this.manifest.urls[url];
          }
        }
      }
      await this._saveManifest();
      this.logger.debug(`Sample removed from cache: ${samplePath}`);
    }
  }

  /**
   * Update sample access time
   * @param {string} samplePath - Sample path (relative)
   * @returns {Promise<void>}
   */
  async updateAccessTime(samplePath) {
    if (this.manifest.samples[samplePath]) {
      this.manifest.samples[samplePath].lastAccessed = new Date().toISOString();
      await this._saveManifest();
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<object>} Cache statistics
   */
  async getStats() {
    const samples = Object.keys(this.manifest.samples);
    let totalSize = 0;

    for (const sample of samples) {
      totalSize += this.manifest.samples[sample].size || 0;
    }

    const totalSizeMB = totalSize / (1024 * 1024);
    const usagePercent = this.maxSizeMB > 0
      ? (totalSize / (this.maxSizeMB * 1024 * 1024)) * 100
      : 0;

    return {
      totalSamples: samples.length,
      totalSize,
      totalSizeMB: Number(totalSizeMB.toFixed(4)),
      maxSizeMB: this.maxSizeMB,
      usagePercent: Number(usagePercent.toFixed(6)),
      cacheDir: this.cacheDir
    };
  }

  /**
   * Clear entire cache
   * @returns {Promise<void>}
   */
  async clear() {
    this.logger.info('Clearing sample cache...');

    const samples = Object.keys(this.manifest.samples);

    for (const sample of samples) {
      await this.removeSample(sample);
    }

    this.logger.info(`Cleared ${samples.length} samples from cache`);
  }

  /**
   * Check cache size and cleanup if needed
   * @private
   */
  async _checkCacheSize() {
    const stats = await this.getStats();
    const totalSizeBytes = stats.totalSize;
    const maxSizeBytes = this.maxSizeMB * 1024 * 1024;

    if (totalSizeBytes > maxSizeBytes) {
      this.logger.warn(`Cache size (${stats.totalSizeMB}MB) exceeds limit (${this.maxSizeMB}MB)`);
      await this._cleanupCache();
    }
  }

  /**
   * Cleanup cache using LRU strategy
   * @private
   */
  async _cleanupCache() {
    this.logger.info('Cleaning up cache using LRU strategy...');

    // Get all samples sorted by last access time (oldest first)
    const samples = Object.entries(this.manifest.samples)
      .map(([path, meta]) => ({
        path,
        ...meta,
        lastAccessed: new Date(meta.lastAccessed)
      }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remove oldest samples until under limit
    const maxSizeBytes = this.maxSizeMB * 1024 * 1024;
    let currentSize = samples.reduce((sum, s) => sum + s.size, 0);
    let removed = 0;

    for (const sample of samples) {
      if (currentSize <= maxSizeBytes * 0.8) { // Clean to 80% of limit
        break;
      }

      await this.removeSample(sample.path);
      currentSize -= sample.size;
      removed++;
    }

    this.logger.info(`Removed ${removed} samples from cache`);
  }

  /**
   * Load cache manifest
   * @private
   */
  async _loadManifest() {
    const manifestPath = path.join(this.cacheDir, 'manifest.json');

    if (existsSync(manifestPath)) {
      try {
        const data = await fs.readFile(manifestPath, 'utf-8');
        this.manifest = JSON.parse(data);
        this.logger.debug('Cache manifest loaded');
      } catch (error) {
        this.logger.warn(`Failed to load cache manifest: ${error.message}`);
        this.manifest = this._createEmptyManifest();
      }
    } else {
      this.manifest = this._createEmptyManifest();
      await this._saveManifest();
    }
  }

  /**
   * Save cache manifest
   * @private
   */
  async _saveManifest() {
    const manifestPath = path.join(this.cacheDir, 'manifest.json');

    try {
      await fs.writeFile(manifestPath, JSON.stringify(this.manifest, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save cache manifest: ${error.message}`);
    }
  }

  /**
   * Create empty manifest
   * @returns {object} Empty manifest
   * @private
   */
  _createEmptyManifest() {
    return {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      samples: {},
      urls: {},
      packs: {}
    };
  }

  /**
   * Resolve cache directory path
   * @returns {string} Absolute cache directory path
   * @private
   */
  _resolveCacheDir() {
    // Use XDG cache directory
    const xdgCacheHome = process.env.XDG_CACHE_HOME || path.join(process.env.HOME, '.cache');
    return path.join(xdgCacheHome, 'strudel-cli', 'samples');
  }

  /**
   * Ensure cache directory exists
   * @private
   */
  async _ensureCacheDir() {
    if (!existsSync(this.cacheDir)) {
      this.logger.debug(`Creating cache directory: ${this.cacheDir}`);
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Compute SHA256 hash for a buffer
   * @param {Buffer|string} data
   * @returns {string}
   * @private
   */
  _hashBuffer(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Retrieve sample by URL if present in manifest.
   * @param {string} url
   * @returns {Promise<Buffer|null>}
   */
  async getByUrl(url) {
    const relativePath = this.manifest.urls?.[url];
    if (!relativePath) {
      return null;
    }
    const absPath = this.getCachedPath(relativePath);
    if (!absPath) {
      return null;
    }
    await this.updateAccessTime(relativePath);
    return fs.readFile(absPath);
  }

  /**
   * Store a sample by URL with automatic path selection.
   * @param {string} url
   * @param {Buffer|string} data
   * @returns {Promise<string>} absolute cached path
   */
  async setByUrl(url, data) {
    const filename = path.basename(new URL(url).pathname) || `sample-${Date.now()}`;
    const relativePath = path.join('remote', filename);
    const cachedPath = await this.addSample(relativePath, data);
    this.manifest.urls[url] = relativePath;
    await this._saveManifest();
    return cachedPath;
  }

  /**
   * Verify a cached sample against its recorded hash.
   * @param {string} samplePath
   * @returns {Promise<boolean>}
   */
  async verifySample(samplePath) {
    const meta = this.manifest.samples[samplePath];
    if (!meta) return false;
    const absPath = this.getCachedPath(samplePath);
    if (!absPath) return false;
    const data = await fs.readFile(absPath);
    const hash = this._hashBuffer(data);
    return hash === meta.hash;
  }
}
