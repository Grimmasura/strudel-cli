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
  }

  /**
   * Download sample pack from URL
   * @param {string} url - Sample pack URL
   * @param {object} options - Download options
   * @returns {Promise<void>}
   */
  async downloadPack(url, options = {}) {
    this.logger.info(`Downloading sample pack: ${url}`);
    this.logger.warn('Phase 1 MVP: Sample download functionality is stubbed');

    // Phase 1 MVP: Stub implementation
    // Phase 2 will implement:
    // - HTTP/HTTPS download with progress
    // - Archive extraction (zip, tar.gz)
    // - Integrity verification (checksums)
    // - Resumable downloads
    // - Concurrent downloads

    throw new Error(
      'Sample pack download not yet implemented (Phase 2)\n' +
      'Please manually download samples to: ' + this.cache.cacheDir
    );
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
      // Determine protocol
      const protocol = url.startsWith('https') ? https : http;

      // Download to temporary file
      const tempPath = path.join(this.cache.cacheDir, `.download-${Date.now()}`);
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

      // Add to cache
      const cachedPath = await this.cache.addSample(destination, data);

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
      cacheDir: this.cache.cacheDir
    };
  }
}
