/**
 * Config - Configuration management
 *
 * @module core/config
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import Conf from 'conf';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export class Config {
  constructor(options = {}) {
    this.store = new Conf({
      projectName: 'strudel-cli',
      defaults: this.getDefaults()
    });
  }

  /**
   * Get default configuration
   * @returns {object} Default configuration object
   */
  getDefaults() {
    return {
      mode: process.env.STRUDEL_MODE || 'auto',
      audio: {
        backend: process.env.STRUDEL_AUDIO_BACKEND || 'auto',
        sampleRate: 48000,
        bufferSize: 256,
        latency: 10
      },
      samples: {
        localPath: process.env.STRUDEL_SAMPLES_DIR || '~/.strudel/samples',
        autoDownload: false
      },
      offline: process.env.STRUDEL_OFFLINE === 'true'
    };
  }

  /**
   * Get configuration value
   * @param {string} key - Dot-notation key (e.g., 'audio.backend')
   * @returns {*} Configuration value
   */
  get(key) {
    return this.store.get(key);
  }

  /**
   * Set configuration value
   * @param {string} key - Dot-notation key
   * @param {*} value - Value to set
   */
  set(key, value) {
    this.store.set(key, value);
  }

  /**
   * Load configuration from file or environment
   * @returns {Config} Config instance
   */
  static async load() {
    return new Config();
  }
}
