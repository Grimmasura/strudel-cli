/**
 * WebMode - Puppeteer-based WebAudio execution mode
 *
 * Uses headless Chrome to run Strudel patterns via the web REPL.
 * Provides compatibility fallback when native audio backends are unavailable.
 *
 * @module modes/web
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { BaseMode } from './base.js';

export class WebMode extends BaseMode {
  /**
   * Create a WebMode instance
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    super('web', config, logger);
    this.browser = null;
    this.page = null;
    this.strudelUrl = 'https://strudel.cc';
    this.isPlaying = false;
  }

  /**
   * Initialize WebMode by launching Puppeteer browser
   * @param {object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    this.logger.info('Initializing Web mode (Puppeteer)...');

    try {
      // Dynamic import of Puppeteer (optional dependency)
      const puppeteer = await this._loadPuppeteer();

      // Launch browser
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--autoplay-policy=no-user-gesture-required',
          '--disable-web-security' // Allow audio autoplay
        ]
      };

      this.logger.debug('Launching browser...');
      this.browser = await puppeteer.launch(launchOptions);

      // Create new page
      this.page = await this.browser.newPage();

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Enable console logging from browser
      this.page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
          this.logger.error(`Browser: ${text}`);
        } else if (type === 'warning') {
          this.logger.warn(`Browser: ${text}`);
        } else {
          this.logger.debug(`Browser: ${text}`);
        }
      });

      // Load Strudel REPL
      const url = options.strudelUrl || this.strudelUrl;
      this.logger.info(`Loading Strudel REPL from ${url}...`);
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for Strudel to be ready
      await this._waitForStrudel();

      this.logger.info('Web mode initialized successfully');
    } catch (error) {
      const missingPuppeteer =
        error?.message?.includes('Puppeteer not installed') ||
        error?.message?.includes('Cannot find module \'puppeteer\'');
      const message = missingPuppeteer
        ? 'Puppeteer not installed. Install with: npm install puppeteer\n' +
          'Or use native mode: strudel repl --mode native'
        : error?.message || 'Failed to initialize Web mode';
      this.logger.error(`Failed to initialize Web mode: ${message}`);
      await this.cleanup();
      throw new Error(message);
    }
  }

  /**
   * Play a pattern in the browser
   * @param {string} code - Pattern code to execute
   * @param {object} options - Playback options
   * @returns {Promise<void>}
   */
  async play(code, options = {}) {
    if (!this.page) {
      throw new Error('WebMode not initialized. Call initialize() first.');
    }

    this.logger.info('Playing pattern in Web mode');
    this.logger.debug(`Pattern code: ${code.substring(0, 100)}...`);

    try {
      // Inject pattern into browser and evaluate
      const result = await this.page.evaluate(async (patternCode) => {
        try {
          // Check if Strudel REPL is available
          if (typeof window.repl === 'undefined') {
            throw new Error('Strudel REPL not available');
          }

          // Evaluate pattern
          await window.repl.evaluate(patternCode);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, code);

      if (!result.success) {
        throw new Error(`Pattern evaluation failed: ${result.error}`);
      }

      this.isPlaying = true;
      this.logger.info('Pattern playback started in browser');
    } catch (error) {
      this.logger.error(`Failed to play pattern: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop playback
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.page) {
      this.logger.warn('No page available to stop');
      return;
    }

    this.logger.info('Stopping Web mode playback...');

    try {
      await this.page.evaluate(() => {
        if (typeof window.repl !== 'undefined' && window.repl.stop) {
          window.repl.stop();
        }
      });

      this.isPlaying = false;
      this.logger.info('Playback stopped');
    } catch (error) {
      this.logger.error(`Error stopping playback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup resources and close browser
   * @returns {Promise<void>}
   */
  async cleanup() {
    await super.cleanup();

    if (this.page) {
      try {
        await this.page.close();
        this.logger.debug('Browser page closed');
      } catch (error) {
        this.logger.warn(`Error closing page: ${error.message}`);
      }
      this.page = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.debug('Browser closed');
      } catch (error) {
        this.logger.warn(`Error closing browser: ${error.message}`);
      }
      this.browser = null;
    }

    this.isPlaying = false;
  }

  /**
   * Wait for Strudel REPL to be ready in the browser
   * @returns {Promise<void>}
   * @private
   */
  async _waitForStrudel() {
    this.logger.debug('Waiting for Strudel to be ready...');

    try {
      await this.page.waitForFunction(
        () => {
          // Check for Strudel global or REPL
          return typeof window.repl !== 'undefined' ||
                 typeof window.strudel !== 'undefined';
        },
        { timeout: 10000 }
      );

      this.logger.debug('Strudel REPL is ready');
    } catch (error) {
      this.logger.warn('Strudel REPL not detected, continuing anyway...');
      // Don't throw - some versions might use different globals
    }
  }

  /**
   * Load Puppeteer module
   * @returns {Promise<object>} Puppeteer module
   * @throws {Error} If Puppeteer is not installed
   * @private
  */
  async _loadPuppeteer() {
    // During tests, always return stub to avoid launching browsers
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      return this._createPuppeteerStub();
    }

    try {
      return await import('puppeteer');
    } catch (error) {
      throw new Error(
        'Puppeteer not installed. Install with: npm install puppeteer\n' +
        'Or use native mode: strudel repl --mode native'
      );
    }
  }

  /**
   * Create a minimal Puppeteer stub for test environments.
   * @returns {object} Stubbed puppeteer-like interface
   * @private
   */
  _createPuppeteerStub() {
    const page = {
      setViewport: async () => {},
      on: () => {},
      goto: async () => {},
      waitForFunction: async () => {},
      evaluate: async () => {},
      close: async () => {}
    };

    const browser = {
      newPage: async () => page,
      close: async () => {}
    };

    const stub = {
      __stub: true,
      __page: page,
      __browser: browser,
      launch: async () => browser
    };

    return stub;
  }

  /**
   * Get current playback state
   * @returns {object} Playback state
   */
  getState() {
    return {
      mode: this.name,
      isPlaying: this.isPlaying,
      browserActive: this.browser !== null,
      pageActive: this.page !== null
    };
  }
}
