/**
 * Sample Downloader - Download sample packs from remote sources
 *
 * Handles downloading and extracting sample packs from URLs or repositories.
 * Phase 1 MVP: Basic download functionality stub (full implementation in Phase 2).
 *
 * @module samples/downloader
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import https from 'https';
import http from 'http';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class SampleDownloader {
  /**
   * Create a SampleDownloader instance
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   * @param {SampleCache} cache - Sample cache instance
   */
  constructor(config, logger, cache) {
    this.config = config;
    this.logger = logger;
    this.cache = cache;
    this.autoDownload = config.get('samples.autoDownload') || false;
    this.concurrent = config.get('samples.concurrentDownloads') || 2;
  }

  /**
   * Download sample pack from URL
   * @param {string} url - Sample pack URL
   * @param {object} options - Download options
   * @returns {Promise<void>}
   */
  async downloadPack(url, options = {}) {
    this.logger.info(`Downloading sample pack: ${url}`);

    // Basic streaming download to cache root under packs/
    const destDir = path.join('packs', path.basename(url));
    await this._ensureCacheInitialized();
    const targetPath = path.join(destDir, path.basename(url));
    const absPath = path.join(this.cache.cacheDir, targetPath);

    const streamResult = await this._streamToFile(url, absPath, {
      onProgress: options.progress,
      expectedHash: options.expectedHash
    });
    const hash =
      streamResult?.hash ||
      this._hashBuffer(await fs.readFile(absPath));

    // Update manifest entry for pack
    const now = new Date().toISOString();
    this.cache.manifest.urls[url] = targetPath;
    this.cache.manifest.packs[url] = {
      path: targetPath,
      hash,
      downloadedAt: now
    };
    await this.cache._saveManifest();

    // Extract archives if requested
    if (options.extract !== false && this._isArchive(absPath)) {
      const extractTarget = path.join(
        this.cache.cacheDir,
        path.join(path.dirname(targetPath), path.parse(targetPath).name)
      );
      await this._extractArchive(absPath, extractTarget);
      const fileHashes = await this._hashExtractedFiles(extractTarget);
      this.cache.manifest.packs[url].extractedTo = extractTarget;
      this.cache.manifest.packs[url].files = fileHashes;
      await this.cache._saveManifest();
    }

    return absPath;
  }

  /**
   * Download single sample file
   * @param {string} url - Sample URL
   * @param {string} destination - Destination path (relative to cache)
   * @param {object} options - Download options
   * @returns {Promise<string>} Path to downloaded sample
   */
  async downloadSample(url, destination, options = {}) {
    this.logger.debug(`Downloading sample: ${url}`);

    try {
      await this._ensureCacheInitialized();
      const tempName = `.download-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Determine protocol
      const protocol = url.startsWith('https') ? https : http;

      // Download to temporary file
      const tempPath = path.join(this.cache.cacheDir, tempName);
      const fileStream = createWriteStream(tempPath);

      await new Promise((resolve, reject) => {
        protocol.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (error) => {
            fs.unlink(tempPath).catch(() => {});
            reject(error);
          });
        }).on('error', (error) => {
          fs.unlink(tempPath).catch(() => {});
          reject(error);
        });
      });

      // Read downloaded file
      const data = await fs.readFile(tempPath);
      const hash = this._hashBuffer(data);
      if (options.expectedHash && hash !== options.expectedHash) {
        await fs.unlink(tempPath).catch(() => {});
        throw new Error('Sample failed checksum verification');
      }

      // Add to cache
      const cachedPath = await this.cache.addSample(destination, data);
      this.cache.manifest.urls[url] = destination;
      await this.cache._saveManifest();

      // Remove temporary file
      await fs.unlink(tempPath);

      this.logger.info(`Sample downloaded: ${destination}`);

      return cachedPath;
    } catch (error) {
      this.logger.error(`Failed to download sample: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of available sample packs
   * @returns {Promise<Array>} List of available packs
   */
  async listAvailablePacks() {
    this.logger.debug('Listing available sample packs...');
    this.logger.warn('Phase 1 MVP: Pack listing is stubbed');

    // Phase 1 MVP: Return hardcoded list
    // Phase 2 will fetch from remote registry
    return [
      {
        name: 'strudel-default',
        description: 'Default Strudel sample pack',
        url: 'https://github.com/tidalcycles/Dirt-Samples/archive/refs/heads/master.zip',
        size: '350MB',
        samples: 1200,
        status: 'available'
      },
      {
        name: 'dirt-samples',
        description: 'Classic Dirt sample library',
        url: 'https://github.com/tidalcycles/Dirt-Samples.git',
        size: '350MB',
        samples: 1200,
        status: 'available'
      }
    ];
  }

  /**
   * Check if sample pack is installed
   * @param {string} packName - Pack name
   * @returns {Promise<boolean>} True if installed
   */
  async isPackInstalled(packName) {
    // Phase 1 MVP: Basic check for pack directory
    const packDir = path.join(this.cache.cacheDir, packName);

    try {
      await fs.access(packDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get downloader state
   * @returns {object} Downloader state
   */
  getState() {
    return {
      autoDownload: this.autoDownload,
      cacheDir: this.cache.cacheDir,
      concurrent: this.concurrent
    };
  }

  _isArchive(filePath) {
    return /\.(zip|tar\.gz|tgz)$/i.test(filePath);
  }

  async _extractArchive(archivePath, targetDir) {
    await fs.mkdir(targetDir, { recursive: true });

    if (archivePath.endsWith('.zip')) {
      await execFileAsync('unzip', ['-o', archivePath, '-d', targetDir]);
      return;
    }

    if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
      await execFileAsync('tar', ['-xzf', archivePath, '-C', targetDir]);
      return;
    }

    throw new Error(`Unsupported archive format: ${archivePath}`);
  }

  /**
   * Stream a remote file to disk with optional progress callback.
   * @private
   */
  async _streamToFile(url, destPath, { onProgress, expectedHash, resume = true } = {}) {
    const protocol = url.startsWith('https') ? https : http;
    const dir = path.dirname(destPath);
    await fs.mkdir(dir, { recursive: true });

    // Support resumable downloads by appending if partial file exists
    let start = 0;
    try {
      const stat = await fs.stat(destPath);
      start = resume ? stat.size : 0;
    } catch {
      start = 0;
    }

    const hash = crypto.createHash('sha256');
    if (start > 0) {
      // Seed hash with existing bytes to verify resumed content
      const existing = await fs.readFile(destPath);
      hash.update(existing);
    }

    await new Promise((resolve, reject) => {
      const fileStream = createWriteStream(destPath, { flags: start > 0 ? 'a' : 'w' });
      const requestOptions = start > 0 ? { headers: { Range: `bytes=${start}-` } } : {};

      protocol
        .get(url, requestOptions, (response) => {
          // Handle servers that don't honour range: restart from scratch
          if (response.statusCode === 200 && start > 0) {
            fileStream.close();
            fs.writeFile(destPath, '').then(() => {
              this._streamToFile(url, destPath, { onProgress, expectedHash, resume: false })
                .then(resolve)
                .catch(reject);
            });
            return;
          }

          if (![200, 206].includes(response.statusCode)) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          const total = Number(response.headers['content-length'] || 0) + start;
          let downloaded = start;
          response.on('data', (chunk) => {
            downloaded += chunk.length;
            hash.update(chunk);
            if (typeof onProgress === 'function' && total > 0) {
              onProgress({ downloaded, total, percent: (downloaded / total) * 100 });
            }
          });

          response.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          fileStream.on('error', (err) => {
            fs.unlink(destPath).catch(() => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          fs.unlink(destPath).catch(() => {});
          reject(err);
        });
    });

    const digest = hash.digest('hex');
    if (expectedHash && digest !== expectedHash) {
      await fs.unlink(destPath).catch(() => {});
      throw new Error(`Checksum mismatch: expected ${expectedHash}, got ${digest}`);
    }

    return { hash: digest };
  }

  /**
   * Ensure cache is initialized before downloads.
   * @private
   */
  async _ensureCacheInitialized() {
    if (!this.cache.manifest) {
      await this.cache.initialize();
    }
  }

  _hashBuffer(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async _hashExtractedFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result = {};
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        Object.assign(result, await this._hashExtractedFiles(full));
      } else {
        const data = await fs.readFile(full);
        const rel = path.relative(this.cache.cacheDir, full);
        result[rel] = this._hashBuffer(data);
      }
    }
    return result;
  }
}
