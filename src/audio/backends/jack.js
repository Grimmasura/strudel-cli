import { EventEmitter } from 'events';
import { SpawnBackend } from './spawn-backend.js';

export class JackBackend extends EventEmitter {
  constructor(config, logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.sampleRate = config?.get('audio.sampleRate') || 48000;
    this.channels = config?.get('audio.channels') || 2;
    this.binary = config?.get('audio.jack.binary') || 'jack_play';
    this.spawn = new SpawnBackend({
      binary: this.binary,
      sampleRate: this.sampleRate,
      channels: this.channels,
      format: 'float',
      argsBuilder: ({ sampleRate, channels }) => ['-r', String(sampleRate), '-c', String(channels), '-f', '16'],
      logger
    });
    this.mode = 'spawn';
    this.jackClient = null;
    this.jack = null;
  }

  async initialize() {
    // Try native JACK client first, fall back to jack_play spawn
    try {
      const jack = await this._loadJack();
      await this._initJackClient(jack);
      this.mode = 'jack';
      this.logger?.debug?.('Using native node-jack client');
      return;
    } catch (error) {
      this.logger?.debug?.(`node-jack unavailable (${error.message}); falling back to jack_play`);
      await this.spawn.initialize();
      this.mode = 'spawn';
    }
  }

  async playBuffer(buffer) {
    if (this.mode === 'jack' && this.jackClient?.process) {
      // node-jack expects Float32Array buffers
      try {
        const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
        this.jackClient.process(floatArray);
        return;
      } catch (error) {
        this.logger?.warn?.(`node-jack write failed, falling back to spawn: ${error.message}`);
        this.mode = 'spawn';
      }
    }
    return this.spawn.playBuffer(buffer);
  }

  async stop() {
    if (this.mode === 'jack' && this.jackClient?.close) {
      try {
        this.jackClient.close();
      } catch (error) {
        this.logger?.warn?.(`Error closing jack client: ${error.message}`);
      }
    }
    await this.spawn.stop();
  }

  async cleanup() {
    await this.stop();
    if (this.mode === 'jack') {
      this.jackClient = null;
      this.jack = null;
    }
    await this.spawn.cleanup();
    this.mode = 'spawn';
  }

  static async isAvailable(binary = 'jack_play') {
    try {
      await import('node-jack');
      return true;
    } catch {
      return SpawnBackend.isAvailable(binary);
    }
  }

  async _loadJack() {
    const jackModule = await import('node-jack');
    if (!jackModule || (!jackModule.Client && !jackModule.default)) {
      throw new Error('node-jack client not found');
    }
    return jackModule.Client || jackModule.default;
  }

  async _initJackClient(JackClient) {
    // Minimal jack client: open ports and buffer writer
    const clientName = this.config?.get('audio.jack.clientName') || 'strudel-cli';
    this.jackClient = new JackClient(clientName);
    if (typeof this.jackClient?.process !== 'function') {
      throw new Error('node-jack client missing process method');
    }
    // node-jack uses onProcess callback to provide output buffers; here we just push PCM directly
    this.jackClient.activate();
  }
}
