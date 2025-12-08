#!/usr/bin/env node

/**
 * Strudel CLI - Main Entry Point
 *
 * Hybrid command-line interface for the Strudel live coding environment.
 *
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import { cli } from '../src/cli.js';

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run CLI
cli(process.argv);
