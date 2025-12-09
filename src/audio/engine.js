/**
 * NativeAudioEngine - Bridges Strudel scheduler to native audio backends.
 *
 * Uses @strudel/core's Cyclist scheduler to translate patterns into timed
 * events, then renders lightweight PCM buffers to a provided backend. This is
 * intentionally minimal (sine synthesis only) but exercises real scheduling so
 * backends, metrics, and the REPL have live data to display.
 *
 * @module audio/engine
 */

import { Cyclist, getFrequency, silence, setTime } from '@strudel/core';
import { performance } from 'perf_hooks';

export class NativeAudioEngine {
  /**
   * @param {object} options
   * @param {object} options.backend - Audio backend implementing playBuffer()
   * @param {Config} options.config - Config provider
   * @param {Logger} options.logger - Logger instance
   */
  constructor({ backend, config, logger }) {
    this.backend = backend;
    this.config = config;
    this.logger = logger;

    this.sampleRate = this.config?.get('audio.sampleRate') || 48000;
    this.channels = this.config?.get('audio.channels') || 2;
    this.latencyMs = this.config?.get('audio.latency') || 10;
    this.outputGain = this.config?.get('audio.outputGain') || 0.2;

    this.scheduler = null;
    this.pattern = null;
    this.started = false;
    this._metrics = {
      lastEventAt: 0,
      cycle: 0,
      bpm: this.config?.get('audio.bpm') || 120,
      cpuAvg: 0,
      latencyMs: this.latencyMs,
      events: 0
    };
  }

  /**
   * Initialise the scheduler. Safe to call multiple times.
   */
  async initialize() {
    if (this.scheduler) {
      return;
    }

    const latency = (this.latencyMs || 10) / 1000;

    this.scheduler = new Cyclist({
      onTrigger: this._handleTrigger.bind(this),
      onToggle: (started) => {
        this.started = started;
        this.logger?.debug?.(`Scheduler ${started ? 'started' : 'stopped'}`);
      },
      getTime: this._now.bind(this),
      latency,
      setInterval: global.setInterval,
      clearInterval: global.clearInterval,
      beforeStart: async () => {
        if (this.backend?.initialize) {
          await this.backend.initialize();
        }
      }
    });

    // Let @strudel/core time helpers use our scheduler clock
    setTime(() => this.scheduler?.now() || 0);

    this.logger?.debug?.('NativeAudioEngine scheduler ready');
  }

  /**
   * Schedule a pattern for playback.
   * @param {object} pattern - Strudel Pattern instance
   */
  async setPattern(pattern) {
    await this.initialize();
    if (!pattern || pattern === silence) {
      this.logger?.warn?.('Ignoring empty pattern in NativeAudioEngine');
      return;
    }

    if (this.started) {
      await this.stop();
    }

    this.pattern = pattern;
    const bpm = this.config?.get('audio.bpm') || 120;
    const cps = bpm / 60;
    this.scheduler.setCps(cps);
    await this.scheduler.setPattern(pattern, true);
    this._metrics.bpm = bpm;
    this.started = true;
    this.logger?.debug?.('Pattern scheduled on NativeAudioEngine');
  }

  /**
   * Stop playback and release scheduler.
   */
  async stop() {
    if (this.scheduler) {
      this.scheduler.stop();
    }
    this.started = false;
  }

  /**
   * Cleanup resources.
   */
  async cleanup() {
    await this.stop();
    this.scheduler = null;
    this.pattern = null;
  }

  /**
   * Get live metrics for visualization/state.
   */
  getMetrics() {
    return {
      ...this._metrics,
      playing: this.started
    };
  }

  _now() {
    return performance.now() / 1000;
  }

  /**
   * Handle scheduled hap -> render short PCM burst to backend.
   * @private
   */
  async _handleTrigger(hap, _deadline, duration, cps, targetTime) {
    if (!this.backend) {
      this.logger?.warn?.('No backend attached; dropping audio event');
      return;
    }

    // Compute frequency with graceful fallbacks
    let freq = 440;
    try {
      freq = getFrequency(hap);
    } catch {
      if (typeof hap?.value === 'string') {
        // Hash string to frequency range for percussion-ish tones
        const hash = [...hap.value].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        freq = 200 + (hash % 600);
      }
    }

    const amplitude = Math.min(1, hap?.value?.amp ?? this.outputGain);
    const durationSec = Math.max(0.03, duration || 0.15);
    const renderStart = performance.now();
    const buffer = this._synthesizeSine(freq, durationSec, amplitude);
    const renderCost = performance.now() - renderStart;

    const fireInMs = Math.max(0, (targetTime - this._now()) * 1000);
    setTimeout(async () => {
      try {
        await this.backend.playBuffer(buffer);
      } catch (error) {
        this.logger?.warn?.(`Backend write failed: ${error.message}`);
      }
    }, fireInMs);

    this._metrics.events += 1;
    this._metrics.cycle = this.scheduler?.lastEnd ?? this._metrics.cycle;
    this._metrics.latencyMs = Math.round(fireInMs);
    this._metrics.cpuAvg = Number(((this._metrics.cpuAvg * 0.9 + renderCost * 0.1)).toFixed(4));
  }

  /**
   * Generate a simple sine buffer with a short fade-in/out to avoid clicks.
   * @private
   */
  _synthesizeSine(frequency, durationSec, amplitude) {
    const totalSamples = Math.max(1, Math.floor(durationSec * this.sampleRate));
    const buffer = Buffer.alloc(totalSamples * this.channels * 4);
    const fadeSamples = Math.min(256, Math.floor(totalSamples * 0.1));

    for (let i = 0; i < totalSamples; i += 1) {
      const phase = (2 * Math.PI * frequency * i) / this.sampleRate;
      const fadeIn = i < fadeSamples ? i / fadeSamples : 1;
      const fadeOut = i > totalSamples - fadeSamples ? (totalSamples - i) / fadeSamples : 1;
      const env = Math.min(fadeIn, fadeOut);
      const sample = Math.sin(phase) * amplitude * env;
      for (let ch = 0; ch < this.channels; ch += 1) {
        const idx = (i * this.channels + ch) * 4;
        buffer.writeFloatLE(sample, idx);
      }
    }

    return buffer;
  }
}
