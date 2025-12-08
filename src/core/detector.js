/**
 * Detector - Auto-detection of available audio backends and optimal mode
 *
 * @module core/detector
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class Detector {
  /**
   * Detect available audio backends on the system
   * @returns {Promise<string[]>} Array of available backends
   */
  static async detectAudioBackends() {
    const backends = [];

    // Check for ALSA
    try {
      await execAsync('which aplay');
      backends.push('alsa');
    } catch (error) {
      // ALSA not available
    }

    // Check for JACK
    try {
      await execAsync('which jack_lsp');
      backends.push('jack');
    } catch (error) {
      // JACK not available
    }

    // Check for PulseAudio
    try {
      await execAsync('which pactl');
      backends.push('pulse');
    } catch (error) {
      // PulseAudio not available
    }

    return backends;
  }

  /**
   * Detect optimal execution mode based on available backends
   * @returns {Promise<string>} Recommended mode (native|web|osc)
   */
  static async detectOptimalMode() {
    const backends = await this.detectAudioBackends();

    if (backends.includes('jack')) {
      return 'native'; // JACK is best for low-latency
    } else if (backends.includes('alsa')) {
      return 'native'; // ALSA is second-best
    } else if (backends.includes('pulse')) {
      return 'native'; // PulseAudio is acceptable
    } else {
      return 'web'; // Fallback to Puppeteer/WebAudio
    }
  }

  /**
   * Get system information for diagnostics
   * @returns {Promise<object>} System information
   */
  static async getSystemInfo() {
    const backends = await this.detectAudioBackends();
    const mode = await this.detectOptimalMode();

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      availableBackends: backends,
      recommendedMode: mode
    };
  }
}
