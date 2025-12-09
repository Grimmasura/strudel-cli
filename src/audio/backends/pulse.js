import { SpawnBackend } from './spawn-backend.js';

export class PulseAudioBackend extends SpawnBackend {
  constructor(config, logger) {
    super({
      binary: config?.get('audio.pulse.binary') || 'paplay',
      sampleRate: config?.get('audio.sampleRate') || 48000,
      channels: config?.get('audio.channels') || 2,
      format: 'float32le',
      argsBuilder: ({ sampleRate, channels, format }) => [
        '--raw',
        '--rate',
        String(sampleRate),
        '--channels',
        String(channels),
        '--format',
        format,
        '-'
      ],
      logger
    });
  }

  static async isAvailable(binary = 'paplay') {
    return SpawnBackend.isAvailable(binary);
  }
}
