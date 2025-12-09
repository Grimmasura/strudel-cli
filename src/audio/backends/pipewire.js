/**
 * PipeWire Backend - Lightweight PipeWire audio output
 *
 * Spawns a `pw-play` process and streams raw audio over stdin. Designed for
 * low-latency playback (5-10ms) and simple buffer writing for early alpha.
 *
 * @module audio/backends/pipewire
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { EventEmitter } from 'events';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class PipeWireBackend extends EventEmitter {
  /**
   * Create a PipeWire backend instance.
   * @param {Config} config - Config provider
   * @param {Logger} logger - Logger instance
   */
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.process = null;
    this.sampleRate = this.config?.get('audio.sampleRate') || 48000;
    this.channels = this.config?.get('audio.channels') || 2;
    this.format = 'F32_LE';
    this.latencyMs = this.config?.get('audio.latency') || 10;
    this.binary = this.config?.get('audio.pipewire.binary') || 'pw-play';
    this.initialized = false;
  }

  /**
   * Check if PipeWire is available on the system.
   * @param {string} binary - PipeWire playback binary to check
   * @returns {Promise<boolean>} True if available
   */
  static async isAvailable(binary = 'pw-play') {
    try {
      await execFileAsync('which', [binary]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize PipeWire backend by spawning pw-play.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    const args = [
      '-f',
      this.format,
      '-c',
      String(this.channels),
      '-r',
      String(this.sampleRate),
      '-'
    ];

    this.logger?.debug?.(`Starting PipeWire backend: ${this.binary} ${args.join(' ')}`);

    this.process = spawn(this.binary, args, {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    this.process.on('error', (err) => {
      this.logger?.error?.(`PipeWire backend error: ${err.message}`);
      this.emit('error', err);
    });

    this.process.stderr?.on?.('data', (data) => {
      // pw-play can be chatty; surface as debug
      this.logger?.debug?.(`pipewire: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code, signal) => {
      this.logger?.debug?.(`PipeWire backend exited (code=${code}, signal=${signal || 'none'})`);
      this.initialized = false;
      this.process = null;
      this.emit('exit', { code, signal });
    });

    this.initialized = true;
  }

  /**
   * Stream raw audio buffer to PipeWire.
   * @param {Buffer} buffer - PCM buffer (F32_LE interleaved)
   * @returns {Promise<void>}
   */
  async playBuffer(buffer) {
    if (!this.initialized || !this.process?.stdin) {
      throw new Error('PipeWire backend not initialized');
    }

    return new Promise((resolve, reject) => {
      this.process.stdin.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Generate and play a sine wave for quick health checks.
   * @param {object} options - Playback options
   * @param {number} options.frequency - Frequency in Hz
   * @param {number} options.durationMs - Duration in milliseconds
   * @param {number} options.amplitude - Amplitude (0-1)
   * @returns {Promise<void>}
   */
  async playSineWave(options = {}) {
    const { frequency = 440, durationMs = 500, amplitude = 0.2 } = options;
    const totalSamples = Math.floor((this.sampleRate * durationMs) / 1000);
    const frameCount = totalSamples * this.channels;
    const buffer = Buffer.alloc(frameCount * 4);

    for (let i = 0; i < totalSamples; i += 1) {
      const sample = Math.sin((2 * Math.PI * frequency * i) / this.sampleRate) * amplitude;
      for (let ch = 0; ch < this.channels; ch += 1) {
        const idx = (i * this.channels + ch) * 4;
        buffer.writeFloatLE(sample, idx);
      }
    }

    await this.playBuffer(buffer);
  }

  /**
   * Stop playback and close the PipeWire process.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.process) {
      return;
    }

    try {
      this.process.stdin?.end();
      this.process.kill('SIGTERM');
    } catch (error) {
      this.logger?.warn?.(`Error stopping PipeWire backend: ${error.message}`);
    }
  }

  /**
   * Cleanup backend resources.
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this.stop();
    this.process = null;
    this.initialized = false;
  }
}
