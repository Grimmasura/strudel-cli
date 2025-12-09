/**
 * SpawnBackend - Generic PCM playback via spawned process.
 *
 * Used for simple command-line audio utilities (aplay, paplay, etc.).
 */
import { EventEmitter } from 'events';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class SpawnBackend extends EventEmitter {
  constructor({ binary, argsBuilder, sampleRate, channels, format = 'F32_LE', logger }) {
    super();
    this.binary = binary;
    this.argsBuilder = argsBuilder;
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.format = format;
    this.logger = logger;
    this.process = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    const args = this.argsBuilder({
      binary: this.binary,
      sampleRate: this.sampleRate,
      channels: this.channels,
      format: this.format
    });

    this.logger?.debug?.(`Starting backend: ${this.binary} ${args.join(' ')}`);
    this.process = spawn(this.binary, args, { stdio: ['pipe', 'ignore', 'pipe'] });

    this.process.on('error', (err) => {
      this.logger?.error?.(`${this.binary} backend error: ${err.message}`);
      this.emit('error', err);
    });

    this.process.stderr?.on?.('data', (data) => {
      this.logger?.debug?.(`${this.binary}: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code, signal) => {
      this.initialized = false;
      this.process = null;
      this.logger?.debug?.(`${this.binary} backend exited (code=${code}, signal=${signal || 'none'})`);
      this.emit('exit', { code, signal });
    });

    this.initialized = true;
  }

  async playBuffer(buffer) {
    if (!this.initialized || !this.process?.stdin) {
      throw new Error(`${this.binary} backend not initialized`);
    }
    return new Promise((resolve, reject) => {
      this.process.stdin.write(buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async playSineWave({ frequency = 440, durationMs = 500, amplitude = 0.2 } = {}) {
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

  async stop() {
    if (!this.process) return;
    try {
      this.process.stdin?.end();
      this.process.kill('SIGTERM');
    } catch (error) {
      this.logger?.warn?.(`Error stopping ${this.binary} backend: ${error.message}`);
    }
  }

  async cleanup() {
    await this.stop();
    this.process = null;
    this.initialized = false;
  }

  static async isAvailable(binary) {
    try {
      await execFileAsync('which', [binary]);
      return true;
    } catch {
      return false;
    }
  }
}
