import { SpawnBackend } from './spawn-backend.js';

export class AlsaBackend extends SpawnBackend {
  constructor(config, logger) {
    super({
      binary: config?.get('audio.alsa.binary') || 'aplay',
      sampleRate: config?.get('audio.sampleRate') || 48000,
      channels: config?.get('audio.channels') || 2,
      format: config?.get('audio.alsa.format') || 'FLOAT_LE',
      argsBuilder: ({ sampleRate, channels, format }) => ['-f', format, '-c', String(channels), '-r', String(sampleRate), '-'],
      logger
    });
  }

  static async isAvailable(binary = 'aplay') {
    return SpawnBackend.isAvailable(binary);
  }
}
