/**
 * NativeMode - Native audio backend execution mode (PipeWire/ALSA/JACK/Pulse)
 *
 * Uses native Linux audio backends for low-latency pattern playback.
 * Phase 1 MVP: Basic ALSA backend foundation with pattern evaluation stub.
 *
 * @module modes/native
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { BaseMode } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PipeWireBackend } from '../audio/backends/pipewire.js';
import { AlsaBackend } from '../audio/backends/alsa.js';
import { PulseAudioBackend } from '../audio/backends/pulse.js';
import { JackBackend } from '../audio/backends/jack.js';
import { PatternEvaluator } from '../patterns/evaluator.js';

const execAsync = promisify(exec);

export class NativeMode extends BaseMode {
  /**
   * Create a NativeMode instance
   * @param {Config} config - Configuration instance
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    super('native', config, logger);
    this.audioContext = null;
    this.backend = null;
    this.audioBackend = null;
    this.evaluator = null;
    this.isPlaying = false;
    this.currentPattern = null;
  }

  /**
   * Initialize NativeMode with audio backend
   * @param {object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(options = {}) {
    this.logger.info('Initializing Native mode...');

    try {
      // Detect and select audio backend
      const requestedBackend = options.backend || this.config.get('audio.backend') || 'auto';
      this.backend = await this._selectBackend(requestedBackend);

      this.logger.info(`Selected audio backend: ${this.backend}`);

      // Phase 1 MVP: Create minimal audio context foundation
      this.audioContext = this._createMinimalAudioContext();

      // Initialize backend driver
      this.audioBackend = this._createAudioBackend(this.backend);
      if (this.audioBackend?.initialize) {
        await this.audioBackend.initialize();
      }

      // Phase 1 MVP: Pattern evaluator stub (full implementation in Phase 2)
      this.evaluator = this._createPatternEvaluator();

      this.logger.info('Native mode initialized successfully');
      this.logger.warn('Native mode is in Phase 1 MVP - limited functionality');
    } catch (error) {
      this.logger.error(`Failed to initialize Native mode: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Play a pattern with native audio backend
   * @param {string} code - Pattern code to execute
   * @param {object} options - Playback options
   * @returns {Promise<void>}
   */
  async play(code, options = {}) {
    if (!this.audioContext) {
      throw new Error('NativeMode not initialized. Call initialize() first.');
    }

    // Validate before logging substring to avoid null access
    this._validatePattern(code);

    this.logger.info('Playing pattern in Native mode');
    this.logger.debug(`Pattern code: ${code.substring(0, 100)}...`);
    this.logger.warn('Phase 1 MVP: Pattern evaluation is stubbed (full implementation in Phase 2)');

    try {
      // Store current pattern
      this.currentPattern = code;

      // Phase 1 MVP: Pattern evaluation stub
      // Full implementation requires @strudel/core integration in Phase 2
      await this.evaluator.evaluate(code);

      this.isPlaying = true;
      this.logger.info('Pattern playback started (stubbed)');
      this.logger.debug(`Backend: ${this.backend}, Sample rate: ${this.audioContext.sampleRate}Hz`);
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
    if (!this.audioContext) {
      this.logger.warn('No audio context available to stop');
      return;
    }

    this.logger.info('Stopping Native mode playback...');

    try {
      // Phase 1 MVP: Stop pattern evaluation
      if (this.evaluator) {
        await this.evaluator.stop();
      }

      if (this.audioBackend) {
        await this.audioBackend.stop();
      }

      this.isPlaying = false;
      this.currentPattern = null;
      this.logger.info('Playback stopped');
    } catch (error) {
      this.logger.error(`Error stopping playback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup resources and close audio backend
   * @returns {Promise<void>}
   */
  async cleanup() {
    await super.cleanup();

    if (this.evaluator) {
      try {
        await this.evaluator.cleanup();
        this.logger.debug('Pattern evaluator cleaned up');
      } catch (error) {
        this.logger.warn(`Error cleaning up evaluator: ${error.message}`);
      }
      this.evaluator = null;
    }

    if (this.audioContext) {
      try {
        // Phase 1 MVP: Minimal cleanup (full AudioContext.close() in Phase 2)
        this.audioContext = null;
        this.logger.debug('Audio context released');
      } catch (error) {
        this.logger.warn(`Error releasing audio context: ${error.message}`);
      }
    }

    if (this.audioBackend) {
      try {
        await this.audioBackend.cleanup();
        this.logger.debug('Audio backend cleaned up');
      } catch (error) {
        this.logger.warn(`Error cleaning up audio backend: ${error.message}`);
      }
      this.audioBackend = null;
    }

    this.backend = null;
    this.isPlaying = false;
    this.currentPattern = null;
  }

  /**
   * Get current playback state
   * @returns {object} Playback state
   */
  getState() {
    return {
      mode: this.name,
      isPlaying: this.isPlaying,
      backend: this.backend,
      audioContextActive: this.audioContext !== null,
      audioBackendActive: this.audioBackend !== null,
      evaluatorActive: this.evaluator !== null,
      sampleRate: this.audioContext?.sampleRate || null,
      latencyMs: this.config.get('audio.latency') || null,
      bpm: this.config.get('audio.bpm') || 120,
      currentPattern: this.currentPattern ? this.currentPattern.substring(0, 50) + '...' : null
    };
  }

  /**
   * Create backend instance by name
   * @param {string} backendName
   * @returns {object|null}
   * @private
   */
  _createAudioBackend(backendName) {
    switch (backendName) {
      case 'pipewire':
        return new PipeWireBackend(this.config, this.logger);
      case 'alsa':
        return new AlsaBackend(this.config, this.logger);
      case 'pulse':
        return new PulseAudioBackend(this.config, this.logger);
      case 'jack':
        return new JackBackend(this.config, this.logger);
      default:
        return null;
    }
  }

  /**
   * Select audio backend based on availability and preference
   * @param {string} requestedBackend - Requested backend (auto|pipewire|alsa|jack|pulse)
   * @returns {Promise<string>} Selected backend name
   * @private
   */
  async _selectBackend(requestedBackend) {
    this.logger.debug(`Backend selection: requested=${requestedBackend}`);

    // If specific backend requested, verify availability
    if (requestedBackend !== 'auto') {
      const available = await this._checkBackendAvailable(requestedBackend);
      if (available) {
        return requestedBackend;
      } else {
        this.logger.warn(`Requested backend ${requestedBackend} not available, falling back to auto-detection`);
      }
    }

    // Auto-detect optimal backend (priority: PipeWire > JACK > ALSA > PulseAudio)
    const backends = ['pipewire', 'jack', 'alsa', 'pulse'];
    for (const backend of backends) {
      const available = await this._checkBackendAvailable(backend);
      if (available) {
        this.logger.debug(`Auto-selected backend: ${backend}`);
        return backend;
      }
    }

    throw new Error(
      'No native audio backend available. Please install PipeWire, ALSA, JACK, or PulseAudio.\n' +
      'Or use web mode: strudel repl --mode web'
    );
  }

  /**
   * Check if audio backend is available on system
   * @param {string} backend - Backend to check (pipewire|alsa|jack|pulse)
   * @returns {Promise<boolean>} Backend availability
   * @private
   */
  async _checkBackendAvailable(backend) {
    try {
      switch (backend) {
        case 'pipewire':
          return PipeWireBackend.isAvailable();

        case 'alsa':
          return AlsaBackend.isAvailable();

        case 'jack':
          // Check for JACK daemon or utilities
          try {
            await execAsync('which jack_lsp');
            this.logger.debug('JACK backend available');
            return true;
          } catch {
            // Also check if jackd is running
            try {
              await execAsync('pgrep -x jackd');
              this.logger.debug('JACK backend available (daemon running)');
              return true;
            } catch {
              return false;
            }
          }

        case 'pulse':
          return PulseAudioBackend.isAvailable();

        default:
          this.logger.warn(`Unknown backend: ${backend}`);
          return false;
      }
    } catch (error) {
      this.logger.debug(`Backend ${backend} not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Create minimal audio context for Phase 1 MVP
   * Full WebAudio API polyfill implementation in Phase 2
   * @returns {object} Minimal audio context
   * @private
   */
  _createMinimalAudioContext() {
    const sampleRate = this.config.get('audio.sampleRate') || 48000;
    const bufferSize = this.config.get('audio.bufferSize') || 256;
    const channels = this.config.get('audio.channels') || 2;
    const latency = this.config.get('audio.latency') || 10;

    this.logger.debug(`Creating audio context: ${sampleRate}Hz, ${bufferSize} samples, ${channels} channels`);

    // Phase 1 MVP: Minimal context structure
    // Phase 2 will implement full AudioContext polyfill
    return {
      sampleRate,
      bufferSize,
      channels,
      latency,
      currentTime: 0,
      state: 'running',
      // Stub methods for Phase 2
      createOscillator: () => { throw new Error('Not implemented in Phase 1'); },
      createGain: () => { throw new Error('Not implemented in Phase 1'); },
      createBuffer: () => { throw new Error('Not implemented in Phase 1'); }
    };
  }

  /**
   * Create pattern evaluator for Strudel patterns
   * Phase 1 MVP: Stub implementation
   * @returns {object} Pattern evaluator
   * @private
   */
  _createPatternEvaluator() {
    this.logger.debug('Creating pattern evaluator (vm2 sandbox)');
    return new PatternEvaluator(this.audioContext, this.logger, {}, 5000, async (pattern) => {
      // TODO: Hook pattern into audio scheduling engine
      this.logger.debug(`Pattern received (type=${pattern?.constructor?.name || typeof pattern})`);
    });
  }

  /**
   * Validate pattern syntax (basic check)
   * @param {string} code - Pattern code
   * @throws {Error} If pattern is invalid
   * @private
   */
  _validatePattern(code) {
    if (!code || typeof code !== 'string') {
      throw new Error('Pattern code must be a non-empty string');
    }

    if (code.trim().length === 0) {
      throw new Error('Pattern code cannot be empty');
    }

    // Phase 1 MVP: Basic syntax validation
    // Phase 2 will use full Strudel parser
    this.logger.debug(`Pattern validation: ${code.length} characters`);
  }
}
