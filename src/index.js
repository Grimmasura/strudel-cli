/**
 * Strudel CLI - Main Module Export
 *
 * @module strudel-cli
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

export { Orchestrator } from './core/orchestrator.js';
export { Config } from './core/config.js';
export { Logger } from './core/logger.js';
export { Detector } from './core/detector.js';

export { BaseMode } from './modes/base.js';
export { WebMode } from './modes/web.js';
export { NativeMode } from './modes/native.js';
export { OSCMode } from './modes/osc.js';

export { cli } from './cli.js';

/**
 * Package version from package.json
 */
export const VERSION = '0.1.0';

/**
 * Project metadata
 */
export const metadata = {
  name: 'strudel-cli',
  version: VERSION,
  description: 'Hybrid command-line interface for the Strudel live coding environment',
  author: 'Grimm (Joshua Robert Humphrey)',
  license: 'AGPL-3.0',
  repository: 'https://github.com/Grimmasura/strudel-cli'
};
