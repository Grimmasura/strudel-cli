/**
 * Logger - Structured logging with pino
 *
 * @module core/logger
 * @author Grimm (Joshua Robert Humphrey)
 * @license AGPL-3.0
 */

import pino from 'pino';
import pretty from 'pino-pretty';

export class Logger {
  constructor(options = {}) {
    const level = options.verbose ? 'debug' : (options.quiet ? 'error' : 'info');

    this.logger = pino(
      { level },
      pretty({
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname'
      })
    );
  }

  debug(msg, ...args) {
    this.logger.debug(msg, ...args);
  }

  info(msg, ...args) {
    this.logger.info(msg, ...args);
  }

  warn(msg, ...args) {
    this.logger.warn(msg, ...args);
  }

  error(msg, ...args) {
    this.logger.error(msg, ...args);
  }

  fatal(msg, ...args) {
    this.logger.fatal(msg, ...args);
  }
}
