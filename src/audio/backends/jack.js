import { SpawnBackend } from './spawn-backend.js';

export class JackBackend extends SpawnBackend {
  constructor(config, logger) {
    super({
      binary: config?.get('audio.jack.binary') || 'jack_play',
      sampleRate: config?.get('audio.sampleRate') || 48000,
      channels: config?.get('audio.channels') || 2,
      format: 'float', // jack_play expects float
      argsBuilder: ({ sampleRate, channels }) => ['-r', String(sampleRate), '-c', String(channels), '-f', '16'],
      logger
    });
  }

  static async isAvailable(binary = 'jack_play') {
    return SpawnBackend.isAvailable(binary);
  }
}
