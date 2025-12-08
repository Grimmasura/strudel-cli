/**
 * BaseMode - Abstract base class for execution modes
 *
 * @module modes/base
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

export class BaseMode {
  constructor(name, config, logger) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the mode
   * @param {object} options - Initialization options
   */
  async initialize(options = {}) {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Play a pattern
   * @param {string} code - Pattern code to execute
   * @param {object} options - Playback options
   */
  async play(code, options = {}) {
    throw new Error('play() must be implemented by subclass');
  }

  /**
   * Stop playback
   */
  async stop() {
    throw new Error('stop() must be implemented by subclass');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.logger.info(`Cleaning up ${this.name} mode`);
  }
}
