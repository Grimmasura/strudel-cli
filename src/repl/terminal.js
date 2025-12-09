/**
 * Terminal REPL - Interactive Read-Eval-Print Loop for Strudel patterns
 *
 * Provides a terminal-based interface for live coding with Strudel patterns.
 * Phase 1 MVP: Basic readline integration with pattern evaluation.
 *
 * @module repl/terminal
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import readline from 'readline';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { TerminalVisualizer } from './visualizer.js';

export class REPL {
  /**
   * Create a REPL instance
   * @param {Orchestrator} orchestrator - Orchestrator instance
   * @param {object} options - REPL options
   */
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.options = {
      historySize: options.historySize || 1000,
      showBanner: options.showBanner !== undefined ? options.showBanner : true,
      visualize: options.visualize || false,
      completions: options.completions || null
    };
    this.rl = null;
    this.isRunning = false;
    this.currentPattern = null;
    this.commandHistory = [];
    this.multilineBuffer = [];
    this.inMultilineMode = false;
    this.visualizer = new TerminalVisualizer({ enabled: this.options.visualize, logger: orchestrator.logger });
    this.cycleCounter = 0;
    this.strudelCompletions = this.options.completions || [
      'note',
      'sound',
      's',
      'fast',
      'slow',
      'stack',
      'hush',
      'every',
      'sometimes',
      'rev',
      'degradeBy'
    ];

    // REPL commands
    this.commands = {
      '.help': this._showHelp.bind(this),
      '.exit': this._exit.bind(this),
      '.quit': this._exit.bind(this),
      '.stop': this._stop.bind(this),
      '.hush': this._hush.bind(this),
      '.play': this._playLastPattern.bind(this),
      '.mode': this._switchMode.bind(this),
      '.status': this._showStatus.bind(this),
      '.bpm': this._bpm.bind(this),
      '.clear': this._clearScreen.bind(this),
      '.history': this._showHistory.bind(this)
    };
  }

  /**
   * Start the REPL
   * @returns {Promise<void>}
   */
  async start() {
    // Ensure orchestrator is initialized
    if (!this.orchestrator.isInitialized) {
      await this.orchestrator.initialize(this.options);
    }

    // Create readline interface
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this._getPrompt(),
      historySize: this.options.historySize,
      completer: this._completer.bind(this)
    });

    // Setup readline event handlers
    this._setupReadlineHandlers();

    // Show welcome banner
    if (this.options.showBanner !== false) {
      this._showBanner();
    }

    // Show initial help
    console.log(chalk.gray('Type .help for commands, or enter Strudel patterns to evaluate'));
    console.log(chalk.gray('Use Ctrl+C or .exit to quit\n'));

    this.isRunning = true;
    this.rl.prompt();

    // Return promise that resolves when REPL exits
    return new Promise((resolve) => {
      this.rl.on('close', () => {
        resolve();
      });
    });
  }

  /**
   * Setup readline event handlers
   * @private
   */
  _setupReadlineHandlers() {
    // Handle line input
    this.rl.on('line', async (line) => {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) {
        this.rl.prompt();
        return;
      }

      // Check for multiline continuation
      if (this._needsContinuation(trimmed)) {
        this.inMultilineMode = true;
        const lineWithoutEscape = trimmed.endsWith('\\') ? trimmed.slice(0, -1) : trimmed;
        this.multilineBuffer.push(lineWithoutEscape);
        this.rl.setPrompt('... ');
        this.rl.prompt();
        return;
      }

      // Build complete input
      let input;
      if (this.inMultilineMode) {
        this.multilineBuffer.push(trimmed);
        input = this.multilineBuffer.join('\n');
        this.multilineBuffer = [];
        this.inMultilineMode = false;
        this.rl.setPrompt(this._getPrompt());
      } else {
        input = trimmed;
      }

      // Add to history
      this.commandHistory.push(input);

      // Check for REPL commands
      if (input.startsWith('.')) {
        await this._handleCommand(input);
      } else {
        // Evaluate as Strudel pattern
        await this._evaluatePattern(input);
      }

      this.rl.prompt();
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      if (this.inMultilineMode) {
        // Cancel multiline input
        console.log(chalk.yellow('\n(Multiline input cancelled)'));
        this.multilineBuffer = [];
        this.inMultilineMode = false;
        this.rl.setPrompt(this._getPrompt());
        this.rl.prompt();
      } else {
        // Ask for confirmation to exit
        console.log(chalk.yellow('\n(To exit, press Ctrl+C again or type .exit)'));
        this.rl.prompt();
      }
    });

    // Handle close
    this.rl.on('close', async () => {
      console.log(chalk.cyan('\nGoodbye!'));
      await this._cleanup();
    });
  }

  /**
   * Handle REPL command
   * @param {string} input - Command input
   * @private
   */
  async _handleCommand(input) {
    const parts = input.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    if (this.commands[command]) {
      await this.commands[command](args);
    } else {
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log(chalk.gray('Type .help for available commands'));
    }
  }

  /**
   * Evaluate Strudel pattern
   * @param {string} code - Pattern code
   * @private
   */
  async _evaluatePattern(code) {
    try {
      this.orchestrator.logger.debug(`Evaluating pattern: ${code.substring(0, 50)}...`);

      // Phase 1 MVP: Use current mode's play() method
      // This will call WebMode or NativeMode's pattern evaluation
      await this.orchestrator.currentMode.play(code);

      this.currentPattern = code;
      console.log(chalk.green('✓ Pattern playing'));
      this._renderVisualization(code);
    } catch (error) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
      this.orchestrator.logger.debug(`Pattern evaluation error: ${error.stack}`);
    }
  }

  /**
   * Show help information
   * @private
   */
  async _showHelp() {
    console.log(chalk.bold('\nStrudel CLI REPL Commands:\n'));
    console.log(chalk.cyan('  .help') + '              Show this help message');
    console.log(chalk.cyan('  .exit, .quit') + '       Exit the REPL');
    console.log(chalk.cyan('  .stop, .hush') + '       Stop current pattern playback');
    console.log(chalk.cyan('  .play') + '              Replay last pattern');
    console.log(chalk.cyan('  .mode <mode>') + '       Switch execution mode (web|native|osc)');
    console.log(chalk.cyan('  .status') + '            Show current status');
    console.log(chalk.cyan('  .bpm [value]') + '       Show or set BPM');
    console.log(chalk.cyan('  .clear') + '             Clear screen');
    console.log(chalk.cyan('  .history') + '           Show command history');
    console.log();
    console.log(chalk.gray('Pattern syntax:'));
    console.log(chalk.gray('  sound("bd sd hh cp").fast(2)'));
    console.log(chalk.gray('  note("c3 e3 g3").s("piano")'));
    console.log(chalk.gray('  Use \\ at end of line for multiline patterns'));
    console.log();
  }

  /**
   * Exit REPL
   * @private
   */
  async _exit() {
    console.log(chalk.cyan('Exiting...'));
    this.isRunning = false;
    this.rl.close();
  }

  /**
   * Stop current pattern playback
   * @private
   */
  async _stop() {
    try {
      await this.orchestrator.stop();
      console.log(chalk.green('✓ Playback stopped'));
    } catch (error) {
      console.log(chalk.red(`✗ Error stopping: ${error.message}`));
    }
  }

  /**
   * Hush/stop all playback
   * @private
   */
  async _hush() {
    await this._stop();
    this.currentPattern = null;
  }

  /**
   * Replay last pattern
   * @private
   */
  async _playLastPattern() {
    if (!this.currentPattern) {
      console.log(chalk.yellow('No pattern to replay'));
      return;
    }

    console.log(chalk.gray(`Replaying: ${this.currentPattern.substring(0, 50)}...`));
    await this._evaluatePattern(this.currentPattern);
  }

  /**
   * Switch execution mode
   * @param {Array<string>} args - Command arguments
   * @private
   */
  async _switchMode(args) {
    if (args.length === 0) {
      console.log(chalk.yellow('Usage: .mode <web|native|osc>'));
      const state = this.orchestrator.getState();
      console.log(chalk.gray(`Current mode: ${state.currentMode}`));
      return;
    }

    const newMode = args[0];
    try {
      console.log(chalk.gray(`Switching to ${newMode} mode...`));
      await this.orchestrator.switchMode(newMode);
      console.log(chalk.green(`✓ Switched to ${newMode} mode`));
    } catch (error) {
      console.log(chalk.red(`✗ Error switching mode: ${error.message}`));
    }
  }

  /**
   * Show current status
   * @private
   */
  async _showStatus() {
    const state = this.orchestrator.getState();
    const modeState = this.orchestrator.currentMode?.getState();

    console.log(chalk.bold('\nStrudel CLI Status:\n'));
    console.log(chalk.cyan('  Mode:') + `              ${state.currentMode || 'none'}`);
    console.log(chalk.cyan('  Initialized:') + `       ${state.isInitialized ? 'yes' : 'no'}`);

    if (modeState) {
      console.log(chalk.cyan('  Playing:') + `           ${modeState.isPlaying ? 'yes' : 'no'}`);

      if (modeState.backend) {
        console.log(chalk.cyan('  Audio Backend:') + `     ${modeState.backend}`);
      }
      if (modeState.sampleRate) {
        console.log(chalk.cyan('  Sample Rate:') + `       ${modeState.sampleRate}Hz`);
      }
      if (modeState.bpm) {
        console.log(chalk.cyan('  BPM:') + `              ${modeState.bpm}`);
      }
      if (modeState.latencyMs !== undefined) {
        console.log(chalk.cyan('  Latency:') + `          ${modeState.latencyMs}ms`);
      }
      if (modeState.cpu !== undefined) {
        console.log(chalk.cyan('  CPU:') + `              ${modeState.cpu || 0}%`);
      }
      if (modeState.browserActive !== undefined) {
        console.log(chalk.cyan('  Browser:') + `           ${modeState.browserActive ? 'active' : 'inactive'}`);
      }
    }

    if (this.currentPattern) {
    console.log(chalk.cyan('  Last Pattern:') + `      ${this.currentPattern.substring(0, 40)}...`);
  }

  console.log(chalk.cyan('  History:') + `           ${this.commandHistory.length} commands`);
  console.log();
}

  /**
   * Clear screen
   * @private
   */
  async _clearScreen() {
    console.clear();
    if (this.options.showBanner !== false) {
      this._showBanner();
    }
  }

  /**
   * Show command history
   * @private
   */
  async _showHistory() {
    if (this.commandHistory.length === 0) {
      console.log(chalk.gray('No command history'));
      return;
    }

    console.log(chalk.bold('\nCommand History:\n'));
    const recentHistory = this.commandHistory.slice(-20); // Show last 20
    recentHistory.forEach((cmd, index) => {
      const displayIndex = this.commandHistory.length - recentHistory.length + index + 1;
      console.log(chalk.gray(`  ${displayIndex}.`) + ` ${cmd.substring(0, 60)}${cmd.length > 60 ? '...' : ''}`);
    });
    console.log();
  }

  /**
   * Show or set BPM (stored in config)
   * @param {Array<string>} args
   * @private
   */
  async _bpm(args = []) {
    if (args.length === 0) {
      const currentBpm = this.orchestrator.config.get('audio.bpm') || 120;
      console.log(chalk.gray(`Current BPM: ${currentBpm}`));
      return;
    }
    const val = Number(args[0]);
    if (Number.isNaN(val) || val <= 0) {
      console.log(chalk.red('Invalid BPM value'));
      return;
    }
    this.orchestrator.config.set('audio.bpm', val);
    console.log(chalk.green(`✓ BPM set to ${val}`));
  }

  /**
   * Show welcome banner
   * @private
   */
  _showBanner() {
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.bold.white('Strudel CLI - Live Coding REPL') + '  ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));

    const state = this.orchestrator.getState();
    console.log(chalk.gray(`Mode: ${state.currentMode || 'auto'}`));

    if (this.orchestrator.currentMode) {
      const modeState = this.orchestrator.currentMode.getState();
      if (modeState.backend) {
        console.log(chalk.gray(`Backend: ${modeState.backend}`));
      }
    }
    console.log();
  }

  /**
   * Get REPL prompt string
   * @returns {string} Prompt string
   * @private
   */
  _getPrompt() {
    const mode = this.orchestrator.currentMode?.name || 'none';
    const isPlaying = this.orchestrator.currentMode?.isPlaying || false;

    const modeIndicator = chalk.blue(`[${mode}]`);
    const playIndicator = isPlaying ? chalk.green('♪') : chalk.gray('○');

    return `${modeIndicator} ${playIndicator} > `;
  }

  /**
   * Render visualization if enabled
   * @param {string} pattern
   * @private
   */
  _renderVisualization(pattern) {
    if (!this.options.visualize) {
      return;
    }
    const state = this.orchestrator.currentMode?.getState?.() || {};
    const latency = state.latencyMs || this.orchestrator.config?.get?.('audio.latency') || null;
    this.visualizer.render({
      pattern,
      cycle: state.cycle || this._nextCycle(),
      bpm: state.bpm || 120,
      cpu: state.cpu || 0,
      latencyMs: latency,
      playing: state.isPlaying || false
    });
  }

  _nextCycle() {
    this.cycleCounter += 0.25;
    return this.cycleCounter;
  }

  /**
   * Provide tab completions for commands and common pattern functions
   * @param {string} line
   * @returns {[string[], string]}
   * @private
   */
  _completer(line) {
    const commandKeys = Object.keys(this.commands);
    const completions = [...commandKeys, ...this.strudelCompletions];
    const hits = completions.filter(c => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  }

  /**
   * Determine if input requires multiline continuation
   * @param {string} input
   * @returns {boolean}
   * @private
   */
  _needsContinuation(input) {
    if (input.endsWith('\\')) {
      return true;
    }
    // Simple bracket balance check
    const open = (input.match(/[\(\[\{]/g) || []).length;
    const close = (input.match(/[\)\]\}]/g) || []).length;
    return open > close;
  }

  /**
   * Cleanup REPL resources
   * @private
   */
  async _cleanup() {
    try {
      this.isRunning = false;

      // Stop any playing patterns
      await Promise.resolve(this.orchestrator.stop()).catch(() => {});

      // Cleanup orchestrator
      await Promise.resolve(this.orchestrator.cleanup()).catch(() => {});

      // Ensure afterEach hooks or callers do not attempt duplicate cleanup
      if (this.orchestrator) {
        this.orchestrator.isInitialized = false;
      }
    } catch (error) {
      // Last-resort swallow to avoid bubbling during shutdown
      this.orchestrator.logger?.debug?.(`REPL cleanup swallow: ${error.message}`);
    }
  }
}
