/**
 * WebMode - Puppeteer-based WebAudio execution mode
 *
 * @module modes/web
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { BaseMode } from './base.js';

export class WebMode extends BaseMode {
  constructor(config, logger) {
    super('web', config, logger);
    this.browser = null;
    this.page = null;
  }

  async initialize(options = {}) {
    this.logger.info('Initializing Web mode (Puppeteer)...');
    // TODO: Launch Puppeteer browser
    // TODO: Load Strudel web REPL
    throw new Error('WebMode not yet implemented (Phase 1)');
  }

  async play(code, options = {}) {
    this.logger.info('Playing pattern in Web mode');
    // TODO: Evaluate pattern in browser context
    throw new Error('WebMode.play() not yet implemented');
  }

  async stop() {
    // TODO: Stop playback
  }

  async cleanup() {
    await super.cleanup();
    // TODO: Close browser
  }
}
