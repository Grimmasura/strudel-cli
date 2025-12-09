/**
 * Strudel CLI - Command Line Interface Setup
 *
 * Defines all CLI commands and options using Commander.js
 *
 * @module cli
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { program } from 'commander';
import chalk from 'chalk';
import { VERSION } from './index.js';
import { Config } from './core/config.js';
import { Logger } from './core/logger.js';
import { SampleCache } from './samples/cache.js';
import { Orchestrator } from './core/orchestrator.js';
import { SampleDownloader } from './samples/downloader.js';

/**
 * Main CLI function
 * @param {string[]} argv - Command line arguments
 */
export async function cli(argv) {
  program
    .name('strudel')
    .description('Hybrid command-line interface for Strudel live coding')
    .version(VERSION, '-v, --version', 'Output the current version');

  // Global options
  program
    .option('--config <path>', 'Use custom config file')
    .option('--verbose', 'Enable verbose logging')
    .option('--quiet', 'Suppress all output except errors');

  // Command: play <file>
  program
    .command('play <file>')
    .description('Play a Strudel pattern file')
    .option('-m, --mode <mode>', 'Backend mode (auto|web|native|osc)', 'auto')
    .option('-s, --samples <path>', 'Local samples directory')
    .option('--offline', 'Use only local assets')
    .option('--no-autoplay', 'Load without playing')
    .action(async (file, options) => {
      const globalOptions = program.opts();
      const config = new Config();
      const logger = new Logger({ verbose: globalOptions.verbose, quiet: globalOptions.quiet });
      if (options.mode) config.set('mode', options.mode);
      if (options.offline) config.set('offline', true);
      if (options.samples) config.set('samples.localPath', options.samples);

      const orchestrator = new Orchestrator(config, logger);
      try {
        if (!options.autoplay) {
          logger.info(`Loading pattern without autoplay from ${file}`);
          await orchestrator.initialize({ mode: options.mode });
          const fs = await import('fs/promises');
          const code = await fs.readFile(file, 'utf-8');
          await orchestrator.currentMode?.evaluator?.evaluate(code);
        } else {
          await orchestrator.play(file, options);
        }
        logger.info('Playback complete');
      } catch (error) {
        logger.error(`Play failed: ${error.message}`);
        process.exitCode = 1;
      }
    });

  // Command: repl
  program
    .command('repl')
    .description('Start interactive REPL')
    .option('-m, --mode <mode>', 'Audio backend mode', 'auto')
    .option('--theme <theme>', 'REPL theme (dark|light)', 'dark')
    .option('--no-banner', 'Hide startup banner')
    .option('--visualize', 'Enable live visualization', true)
    .action(async (options) => {
      const globalOptions = program.opts();
      const config = new Config();
      const logger = new Logger({ verbose: globalOptions.verbose, quiet: globalOptions.quiet });
      config.set('mode', options.mode);
      const orchestrator = new Orchestrator(config, logger);
      try {
        await orchestrator.startREPL({
          ...options,
          showBanner: options.banner !== false,
          visualize: options.visualize !== false,
          mode: options.mode
        });
      } catch (error) {
        logger.error(`REPL failed: ${error.message}`);
        process.exitCode = 1;
      }
    });

  // Command: serve
  program
    .command('serve')
    .description('Start sample server + web REPL')
    .option('-p, --port <port>', 'Server port', '3000')
    .option('-h, --host <host>', 'Server host', '0.0.0.0')
    .option('-s, --samples <path>', 'Samples directory')
    .action(async (options) => {
      console.log(chalk.blue('🌐 Strudel CLI - Server Mode'));
      console.log(chalk.gray(`Host: ${options.host}:${options.port}`));
      console.log(chalk.yellow('\n⚠️  Implementation pending (Phase 1)'));

      // TODO: Import and use Server
      // const { SampleServer } = await import('./samples/server.js');
      // const server = new SampleServer(options);
      // await server.start();
    });

  // Command: init
  program
    .command('init')
    .description('Initialize Strudel environment')
    .option('--samples', 'Download default sample packs')
    .option('--config <preset>', 'Use configuration preset')
    .action(async (options) => {
      console.log(chalk.blue('🚀 Strudel CLI - Initialize'));
      console.log(chalk.yellow('\n⚠️  Implementation pending (Phase 1)'));

      // TODO: Implement initialization
      // - Create config directory
      // - Download samples if requested
      // - Apply configuration preset
    });

  // Command: config
  program
    .command('config')
    .description('Manage configuration')
    .argument('[key]', 'Configuration key to view/edit')
    .argument('[value]', 'New value to set')
    .action(async (key, value, options) => {
      console.log(chalk.blue('⚙️  Strudel CLI - Configuration'));
      console.log(chalk.yellow('\n⚠️  Implementation pending (Phase 1)'));

      // TODO: Implement config management
    });

  // Command: samples
  program
    .command('samples')
    .description('Manage sample libraries')
    .argument('[action]', 'Action: list|verify|clear|stats|download')
    .argument('[target]', 'URL or pack name for download/verify')
    .option('--hash <sha256>', 'Expected SHA256 for downloads')
    .option('--no-extract', 'Skip archive extraction')
    .action(async (action, target, cmdOptions) => {
      const config = new Config();
      const logger = new Logger();
      const cache = new SampleCache(config, logger);
      const downloader = new SampleDownloader(config, logger, cache);
      await cache.initialize();

      switch (action) {
        case 'verify': {
          console.log(chalk.blue('🔍 Verifying sample cache...'));
          const results = await cache.verifyAll();
          const failures = results.filter((r) => !r.ok);
          results.forEach((r) => {
            const target = r.url ? `${r.url} (${r.path})` : r.path;
            if (r.ok) console.log(chalk.green(`✓ ${target}`));
            else console.log(chalk.red(`✗ ${target}: ${r.error || 'hash mismatch'}`));
          });
          console.log(chalk.gray(`Total: ${results.length}, Failures: ${failures.length}`));
          break;
        }
        case 'clear': {
          console.log(chalk.blue('🗑️ Clearing sample cache...'));
          await cache.clear();
          break;
        }
        case 'stats': {
          const stats = await cache.getStats();
          console.log(chalk.blue('📊 Sample cache stats'));
          console.log(`Samples: ${stats.totalSamples}`);
          console.log(`Size: ${stats.totalSizeMB} MB (${stats.usagePercent}% of ${stats.maxSizeMB} MB)`);
          console.log(`Dir: ${stats.cacheDir}`);
          break;
        }
        case 'download': {
          if (!target) {
            console.log(chalk.red('Please provide a URL or pack name to download'));
            break;
          }
          console.log(chalk.blue(`⬇️  Downloading: ${target}`));
          try {
            await downloader.downloadPack(target, {
              expectedHash: cmdOptions.hash,
              extract: cmdOptions.extract !== false
            });
            console.log(chalk.green('✓ Download complete'));
          } catch (error) {
            console.log(chalk.red(`✗ Download failed: ${error.message}`));
            process.exitCode = 1;
          }
          break;
        }
        case 'list':
        default: {
          const stats = await cache.getStats();
          console.log(chalk.blue('📦 Sample cache'));
          console.log(`Samples: ${stats.totalSamples}`);
          console.log(`Size: ${stats.totalSizeMB} MB`);
        }
      }
    });

  // Command: doctor
  program
    .command('doctor')
    .description('Run system diagnostics')
    .action(async (options) => {
      console.log(chalk.blue('🏥 Strudel CLI - System Diagnostics'));
      console.log(chalk.yellow('\n⚠️  Implementation pending (Phase 1)'));

      // TODO: Implement system diagnostics
      // - Check Node.js version
      // - Detect available audio backends
      // - Test sample access
      // - Verify dependencies
    });

  // Parse arguments
  await program.parseAsync(argv);
}
