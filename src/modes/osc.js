/**
 * OSCMode - SuperDirt/SuperCollider OSC execution mode
 *
 * @module modes/osc
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { BaseMode } from './base.js';

export class OSCMode extends BaseMode {
  constructor(config, logger) {
    super('osc', config, logger);
    this.oscClient = null;
  }

  async initialize(options = {}) {
    this.logger.info('Initializing OSC mode (SuperDirt)...');
    // TODO: Connect to SuperDirt via OSC
    throw new Error('OSCMode not yet implemented (Phase 2)');
  }

  async play(code, options = {}) {
    this.logger.info('Playing pattern via OSC');
    // TODO: Send OSC messages to SuperDirt
    throw new Error('OSCMode.play() not yet implemented');
  }

  async stop() {
    // TODO: Stop playback
  }

  async cleanup() {
    await super.cleanup();
    // TODO: Disconnect OSC client
  }
}
