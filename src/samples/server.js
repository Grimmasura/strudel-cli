/**
 * Sample Server - HTTP server for serving local audio samples
 *
 * Provides a local HTTP server to host audio samples for pattern playback.
 * Phase 1 MVP: Basic HTTP file serving with CORS support.
 *
 * @module samples/server
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { createReadStream } from 'fs';

export class SampleServer {
  /**
   * Create a SampleServer instance
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.server = null;
    this.isRunning = false;
    this.port = config.get('samples.serverPort') || 8000;
    this.samplesDir = this._resolveSamplesDir();
  }

  /**
   * Start the sample server
   * @param {object} options - Server options
   * @returns {Promise<void>}
   */
  async start(options = {}) {
    if (this.isRunning) {
      this.logger.warn('Sample server already running');
      return;
    }

    const port = options.port || this.port;

    // Ensure samples directory exists
    await this._ensureSamplesDir();

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this._handleRequest(req, res);
    });

    // Start listening
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        this.isRunning = true;
        this.port = port;
        this.logger.info(`Sample server listening on http://localhost:${port}`);
        this.logger.info(`Serving samples from: ${this.samplesDir}`);
        resolve();
      });

      this.server.on('error', (error) => {
        this.logger.error(`Sample server error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Stop the sample server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      this.logger.warn('Sample server not running');
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.logger.info('Sample server stopped');
        resolve();
      });
    });
  }

  /**
   * Handle HTTP request
   * @param {http.IncomingMessage} req - Request object
   * @param {http.ServerResponse} res - Response object
   * @private
   */
  async _handleRequest(req, res) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only handle GET requests
    if (req.method !== 'GET') {
      this._sendError(res, 405, 'Method Not Allowed');
      return;
    }

    // Parse URL and get file path
    const urlPath = new URL(req.url, `http://localhost:${this.port}`).pathname;

    // Handle root path - show server info
    if (urlPath === '/') {
      this._sendServerInfo(res);
      return;
    }

    // Serve sample file
    await this._serveFile(urlPath, res);
  }

  /**
   * Serve a sample file
   * @param {string} urlPath - URL path
   * @param {http.ServerResponse} res - Response object
   * @private
   */
  async _serveFile(urlPath, res) {
    try {
      // Resolve file path (prevent directory traversal)
      const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.join(this.samplesDir, safePath);

      // Ensure file is within samples directory
      if (!filePath.startsWith(this.samplesDir)) {
        this._sendError(res, 403, 'Forbidden');
        return;
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        this._sendError(res, 404, 'Sample not found');
        this.logger.debug(`Sample not found: ${safePath}`);
        return;
      }

      // Get file stats
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // List directory contents
        await this._serveDirectory(filePath, urlPath, res);
        return;
      }

      // Determine content type
      const contentType = this._getContentType(filePath);

      // Send file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.writeHead(200);

      const stream = createReadStream(filePath);
      stream.pipe(res);

      stream.on('error', (error) => {
        this.logger.error(`Error streaming file: ${error.message}`);
        if (!res.headersSent) {
          this._sendError(res, 500, 'Internal Server Error');
        }
      });

      this.logger.debug(`Served sample: ${safePath} (${stats.size} bytes)`);
    } catch (error) {
      this.logger.error(`Error serving file: ${error.message}`);
      if (!res.headersSent) {
        this._sendError(res, 500, 'Internal Server Error');
      }
    }
  }

  /**
   * Serve directory listing
   * @param {string} dirPath - Directory path
   * @param {string} urlPath - URL path
   * @param {http.ServerResponse} res - Response object
   * @private
   */
  async _serveDirectory(dirPath, urlPath, res) {
    try {
      const files = await fs.readdir(dirPath);

      const items = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            path: path.join(urlPath, file).replace(/\\/g, '/')
          };
        })
      );

      // Sort: directories first, then files
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      // Send JSON directory listing
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({
        path: urlPath,
        items
      }, null, 2));

      this.logger.debug(`Served directory: ${urlPath} (${items.length} items)`);
    } catch (error) {
      this.logger.error(`Error listing directory: ${error.message}`);
      this._sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Send server info page
   * @param {http.ServerResponse} res - Response object
   * @private
   */
  _sendServerInfo(res) {
    const info = {
      name: 'Strudel CLI Sample Server',
      version: '0.1.0',
      status: 'running',
      samplesDir: this.samplesDir,
      port: this.port,
      endpoints: {
        '/': 'This info page',
        '/<sample-path>': 'Serve audio sample file',
        '/<directory-path>/': 'List directory contents (JSON)'
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(info, null, 2));
  }

  /**
   * Send error response
   * @param {http.ServerResponse} res - Response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @private
   */
  _sendError(res, statusCode, message) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Get content type for file
   * @param {string} filePath - File path
   * @returns {string} Content type
   * @private
   */
  _getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.m4a': 'audio/mp4',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Resolve samples directory path
   * @returns {string} Absolute samples directory path
   * @private
   */
  _resolveSamplesDir() {
    const configured = this.config.get('samples.localPath');

    if (configured) {
      // Expand home directory
      const expanded = configured.replace(/^~/, process.env.HOME || process.env.USERPROFILE);
      return path.resolve(expanded);
    }

    // Default: ~/.local/share/strudel-cli/samples
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(process.env.HOME, '.local', 'share');
    return path.join(xdgDataHome, 'strudel-cli', 'samples');
  }

  /**
   * Ensure samples directory exists
   * @private
   */
  async _ensureSamplesDir() {
    try {
      if (!existsSync(this.samplesDir)) {
        this.logger.info(`Creating samples directory: ${this.samplesDir}`);
        await fs.mkdir(this.samplesDir, { recursive: true });
      }
    } catch (error) {
      this.logger.error(`Failed to create samples directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get server URL
   * @returns {string} Server URL
   */
  getURL() {
    if (!this.isRunning) {
      return null;
    }
    return `http://localhost:${this.port}`;
  }

  /**
   * Get server state
   * @returns {object} Server state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      samplesDir: this.samplesDir,
      url: this.getURL()
    };
  }
}
