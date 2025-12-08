/**
 * Orchestrator - Main coordination logic for mode selection and execution
 *
 * Manages the lifecycle of execution modes (Web, Native, OSC) and coordinates
 * pattern evaluation across different audio backends.
 *
 * @module core/orchestrator
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { Detector } from './detector.js';
import { WebMode } from '../modes/web.js';
import { NativeMode } from '../modes/native.js';
import { OSCMode } from '../modes/osc.js';

export class Orchestrator {
  /**
   * Create an Orchestrator
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.currentMode = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the orchestrator and select execution mode
   * @param {object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      this.logger.warn('Orchestrator already initialized');
      return;
    }

    this.logger.info('Initializing Orchestrator...');

    // Select and initialize mode
    const modeType = options.mode || this.config.get('mode') || 'auto';
    this.currentMode = await this.selectMode(modeType);

    await this.currentMode.initialize(options);
    this.isInitialized = true;

    this.logger.info(`Orchestrator initialized with ${this.currentMode.name} mode`);
  }

  /**
   * Play a pattern file
   * @param {string} file - Path to pattern file
   * @param {object} options - Execution options
   * @returns {Promise<void>}
   */
  async play(file, options = {}) {
    this.logger.info(`Playing pattern: ${file}`);

    if (!this.isInitialized) {
      await this.initialize(options);
    }

    try {
      // Read pattern file
      const fs = await import('fs/promises');
      const code = await fs.readFile(file, 'utf-8');

      // Execute pattern
      await this.currentMode.play(code, options);

      this.logger.info('Pattern playback started');
    } catch (error) {
      this.logger.error(`Failed to play pattern: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start interactive REPL
   * @param {object} options - REPL options
   * @returns {Promise<void>}
   */
  async startREPL(options = {}) {
    this.logger.info('Starting REPL...');

    if (!this.isInitialized) {
      await this.initialize(options);
    }

    // Import REPL dynamically when implemented
    try {
      const { REPL } = await import('../repl/terminal.js');
      const repl = new REPL(this, options);
      await repl.start();
    } catch (error) {
      this.logger.error(`REPL not yet implemented: ${error.message}`);
      throw new Error('REPL functionality coming in next phase');
    }
  }

  /**
   * Select optimal execution mode
   * @param {string} modeType - Requested mode (auto|web|native|osc)
   * @returns {Promise<BaseMode>} Selected mode instance
   */
  async selectMode(modeType = 'auto') {
    this.logger.debug(`Selecting mode: ${modeType}`);

    let selectedMode = modeType;

    // Auto-detect optimal mode
    if (modeType === 'auto') {
      selectedMode = await Detector.detectOptimalMode();
      this.logger.info(`Auto-detected optimal mode: ${selectedMode}`);
    }

    // Create mode instance
    let mode;
    switch (selectedMode) {
      case 'web':
        mode = new WebMode(this.config, this.logger);
        break;

      case 'native':
        mode = new NativeMode(this.config, this.logger);
        break;

      case 'osc':
        mode = new OSCMode(this.config, this.logger);
        break;

      default:
        this.logger.warn(`Unknown mode: ${selectedMode}, falling back to web`);
        mode = new WebMode(this.config, this.logger);
    }

    return mode;
  }

  /**
   * Switch to a different execution mode
   * @param {string} modeType - New mode to switch to
   * @param {object} options - Initialization options for new mode
   * @returns {Promise<void>}
   */
  async switchMode(modeType, options = {}) {
    this.logger.info(`Switching from ${this.currentMode?.name} to ${modeType} mode`);

    // Cleanup current mode
    if (this.currentMode) {
      await this.currentMode.cleanup();
    }

    // Select and initialize new mode
    this.currentMode = await this.selectMode(modeType);
    await this.currentMode.initialize(options);

    this.logger.info(`Switched to ${this.currentMode.name} mode`);
  }

  /**
   * Stop playback and cleanup
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.currentMode) {
      this.logger.warn('No active mode to stop');
      return;
    }

    this.logger.info('Stopping playback...');

    try {
      await this.currentMode.stop();
      this.logger.info('Playback stopped');
    } catch (error) {
      this.logger.error(`Error stopping playback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown orchestrator
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.info('Cleaning up Orchestrator...');

    if (this.currentMode) {
      await this.currentMode.cleanup();
      this.currentMode = null;
    }

    this.isInitialized = false;
    this.logger.info('Orchestrator cleanup complete');
  }

  /**
   * Get current orchestrator state
   * @returns {object} Current state information
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      currentMode: this.currentMode?.name || null,
      config: {
        mode: this.config.get('mode'),
        audioBackend: this.config.get('audio.backend'),
        offline: this.config.get('offline')
      }
    };
  }

  /**
   * Validate that orchestrator is ready for operations
   * @throws {Error} If orchestrator is not initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }
  }
}
