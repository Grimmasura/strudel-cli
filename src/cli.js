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
import { SampleServer } from './samples/server.js';
import { PipeWireBackend } from './audio/backends/pipewire.js';
import { AlsaBackend } from './audio/backends/alsa.js';
import { PulseAudioBackend } from './audio/backends/pulse.js';
import { JackBackend } from './audio/backends/jack.js';

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
      const globalOptions = program.opts();
      const config = new Config();
      const logger = new Logger({ verbose: globalOptions.verbose, quiet: globalOptions.quiet });
      if (options.samples) {
        config.set('samples.localPath', options.samples);
      }
      if (options.port) {
        config.set('samples.serverPort', Number(options.port));
      }

      const server = new SampleServer(config, logger);
      try {
        await server.start({ port: Number(options.port) });
        logger.info('Press Ctrl+C to stop the server.');
      } catch (error) {
        logger.error(`Failed to start sample server: ${error.message}`);
        process.exitCode = 1;
      }
    });

  // Command: init
  program
    .command('init')
    .description('Initialize Strudel environment')
    .option('--samples', 'Download default sample packs')
    .option('--config <preset>', 'Use configuration preset')
    .action(async (options) => {
      const globalOptions = program.opts();
      const config = new Config();
      const logger = new Logger({ verbose: globalOptions.verbose, quiet: globalOptions.quiet });
      const cache = new SampleCache(config, logger);
      const downloader = new SampleDownloader(config, logger, cache);

      logger.info('Initializing Strudel environment...');
      await cache.initialize();

      if (options.samples) {
        logger.info('Downloading default sample pack (Dirt-Samples)...');
        const defaultPack =
          'https://github.com/tidalcycles/Dirt-Samples/archive/refs/heads/master.zip';
        try {
          await downloader.downloadPack(defaultPack, { extract: true });
          logger.info('Default samples downloaded.');
        } catch (error) {
          logger.warn(`Sample download failed: ${error.message}`);
        }
      }

      logger.info('Initialization complete.');
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
      const config = new Config();
      const logger = new Logger();
      const cache = new SampleCache(config, logger);

      const checks = [];

      checks.push({
        name: 'Node version',
        ok: parseInt(process.versions.node.split('.')[0], 10) >= 20,
        detail: process.versions.node
      });

      const backendChecks = await Promise.all([
        PipeWireBackend.isAvailable().then((ok) => ({ name: 'PipeWire', ok })),
        AlsaBackend.isAvailable().then((ok) => ({ name: 'ALSA', ok })),
        PulseAudioBackend.isAvailable().then((ok) => ({ name: 'PulseAudio', ok })),
        JackBackend.isAvailable().then((ok) => ({ name: 'JACK', ok }))
      ]);
      checks.push(...backendChecks);

      const puppeteerOk = await import('puppeteer')
        .then(() => true)
        .catch(() => false);
      checks.push({ name: 'Puppeteer installed', ok: puppeteerOk });

      await cache.initialize();
      const stats = await cache.getStats();
      checks.push({
        name: 'Sample cache',
        ok: true,
        detail: `${stats.totalSamples} samples, ${stats.totalSizeMB}MB`
      });

      console.log(chalk.bold('\n🏥 Strudel CLI - System Diagnostics\n'));
      checks.forEach((check) => {
        const status = check.ok ? chalk.green('✓') : chalk.red('✗');
        const detail = check.detail ? ` (${check.detail})` : '';
        console.log(`${status} ${check.name}${detail}`);
      });
      console.log();
    });

  // Parse arguments
  await program.parseAsync(argv);
}
