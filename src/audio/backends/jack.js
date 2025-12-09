import { EventEmitter } from 'events';

/**
 * JackBackend - placeholder stub until dedicated JACK streaming is implemented.
 */
export class JackBackend extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    this.logger?.warn?.('JACK backend stub initialized (audio streaming not yet implemented)');
  }

  async playBuffer() {
    throw new Error('JACK backend playback not yet implemented');
  }

  async playSineWave() {
    throw new Error('JACK backend playback not yet implemented');
  }

  async stop() {
    this.initialized = false;
  }

  async cleanup() {
    this.initialized = false;
  }

  static async isAvailable() {
    // Detection is handled in NativeMode via jack_lsp/jackd presence
    return false;
  }
}
