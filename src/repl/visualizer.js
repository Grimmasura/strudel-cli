/**
 * TerminalVisualizer - Lightweight textual visualizer for REPL playback state.
 *
 * Designed as a minimal scaffold for live updates without heavy dependencies.
 * Rendering is intentionally simple to keep the REPL responsive.
 *
 * @module repl/visualizer
 */

import chalk from 'chalk';

export class TerminalVisualizer {
  /**
   * @param {object} options
   * @param {boolean} options.enabled - Whether to render output
   * @param {Logger} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logger = options.logger;
  }

  /**
   * Render a status block.
   * @param {object} state
   * @param {string} state.pattern - Pattern description
   * @param {number} state.cycle - Cycle position
   * @param {number} state.bpm - Current BPM
   * @param {number} state.cpu - CPU percentage
   * @param {number} state.latencyMs - Measured latency
   * @param {boolean} state.playing - Playback flag
   */
  render(state = {}) {
    if (!this.enabled) {
      return;
    }

    const {
      pattern = '',
      cycle = 0,
      bpm = 120,
      cpu = 0,
      latencyMs = null,
      playing = false,
      events = 0
    } = state;

    const bar = this._renderBar(cycle);
    const lines = [
      chalk.bold.cyan('╭─────────────────────────────────────╮'),
      chalk.bold.cyan('│ ') +
        chalk.white(`Pattern: ${pattern.substring(0, 40)}`.padEnd(33, ' ')) +
        chalk.bold.cyan('│'),
      chalk.bold.cyan('├─────────────────────────────────────┤'),
      chalk.bold.cyan('│ ') +
        chalk.green(bar) +
        chalk.gray(` [Cycle: ${cycle.toFixed(2)}]`).padEnd(29, ' ') +
        chalk.bold.cyan('│'),
      chalk.bold.cyan('│ ') +
        chalk.gray(
          `BPM: ${bpm} | CPU: ${cpu}% | Latency: ${latencyMs ?? '-'}ms | Evts: ${events} | ${
            playing ? '▶' : '■'
          }`
        ).padEnd(33, ' ') +
        chalk.bold.cyan('│'),
      chalk.bold.cyan('╰─────────────────────────────────────╯')
    ];

    const output = lines.join('\n');
    // Clear previous render by logging a separating line
    console.log(output);
    this.logger?.debug?.('Visualizer updated');
  }

  /**
   * Render a simple block bar that wraps around every 12 segments.
   * @param {number} cycle
   * @returns {string}
   * @private
   */
  _renderBar(cycle) {
    const segments = 12;
    const pos = Math.floor((cycle * segments) % segments);
    return Array.from({ length: segments }, (_v, idx) => (idx === pos ? '▮' : '▯')).join('');
  }
}
