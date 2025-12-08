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

export class REPL {
  /**
   * Create a REPL instance
   * @param {Orchestrator} orchestrator - Orchestrator instance
   * @param {object} options - REPL options
   */
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.options = options;
    this.rl = null;
    this.isRunning = false;
    this.currentPattern = null;
    this.commandHistory = [];
    this.multilineBuffer = [];
    this.inMultilineMode = false;

    // REPL commands
    this.commands = {
      '.help': this._showHelp.bind(this),
      '.exit': this._exit.bind(this),
      '.quit': this._exit.bind(this),
      '.stop': this._stop.bind(this),
      '.play': this._playLastPattern.bind(this),
      '.mode': this._switchMode.bind(this),
      '.status': this._showStatus.bind(this),
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
      historySize: this.options.historySize || 1000
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
      if (trimmed.endsWith('\\')) {
        this.inMultilineMode = true;
        this.multilineBuffer.push(trimmed.slice(0, -1));
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
    console.log(chalk.cyan('  .stop') + '              Stop current pattern playback');
    console.log(chalk.cyan('  .play') + '              Replay last pattern');
    console.log(chalk.cyan('  .mode <mode>') + '       Switch execution mode (web|native|osc)');
    console.log(chalk.cyan('  .status') + '            Show current status');
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
   * Cleanup REPL resources
   * @private
   */
  async _cleanup() {
    this.isRunning = false;

    // Stop any playing patterns
    try {
      await this.orchestrator.stop();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Cleanup orchestrator
    try {
      await this.orchestrator.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
