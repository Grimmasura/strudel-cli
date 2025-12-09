import { describe, it, beforeAll, afterAll, expect, beforeEach } from 'vitest';
import http from 'http';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Config } from '../../src/core/config.js';
import { Logger } from '../../src/core/logger.js';
import { SampleCache } from '../../src/samples/cache.js';
import { SampleDownloader } from '../../src/samples/downloader.js';

describe('SampleDownloader', () => {
  let server;
  let baseUrl;
  const sampleData = Buffer.from('strudel-downloader-test-data');

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const start = Number(rangeHeader.replace(/bytes=/, '').split('-')[0]);
        res.statusCode = 206;
        res.setHeader('Content-Length', sampleData.length - start);
        res.setHeader('Content-Range', `bytes ${start}-${sampleData.length - 1}/${sampleData.length}`);
        res.end(sampleData.slice(start));
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Length', sampleData.length);
      res.end(sampleData);
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/sample`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('downloadPack with checksum and resume', () => {
    let tmpDir;
    let config;
    let cache;
    let downloader;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'strudel-dl-'));
      process.env.XDG_CACHE_HOME = tmpDir;
      config = new Config({ confOptions: { cwd: tmpDir } });
      const logger = new Logger({ quiet: true });
      cache = new SampleCache(config, logger);
      downloader = new SampleDownloader(config, logger, cache);
      await cache.initialize();
    });

    it('downloads and verifies checksum', async () => {
      const hash = crypto.createHash('sha256').update(sampleData).digest('hex');
      await downloader.downloadPack(baseUrl, { expectedHash: hash, extract: false });

      const manifestEntry = cache.manifest.packs[baseUrl];
      expect(manifestEntry).toBeDefined();
      const stored = await fs.readFile(path.join(cache.cacheDir, manifestEntry.path));
      expect(stored.equals(sampleData)).toBe(true);
    });

    it('fails checksum mismatch', async () => {
      await expect(
        downloader.downloadPack(baseUrl, { expectedHash: 'deadbeef', extract: false })
      ).rejects.toThrow(/Checksum mismatch|verification/);
    });

    it('resumes a partial download', async () => {
      const destDir = path.join(cache.cacheDir, 'packs', path.basename(baseUrl));
      const destPath = path.join(destDir, path.basename(baseUrl));
      await fs.mkdir(destDir, { recursive: true });

      // Write a partial file to simulate interruption
      await fs.writeFile(destPath, sampleData.slice(0, 5));

      const result = await downloader._streamToFile(baseUrl, destPath, {
        expectedHash: crypto.createHash('sha256').update(sampleData).digest('hex')
      });

      const final = await fs.readFile(destPath);
      expect(final.equals(sampleData)).toBe(true);
      expect(result.hash).toBe(crypto.createHash('sha256').update(sampleData).digest('hex'));
    });
  });
});
