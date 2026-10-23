import pino from 'pino';

/**
 * Central Pino logger.
 *
 * In development:  pretty-prints to the terminal via pino-pretty.
 * In production:   emits newline-delimited JSON (pipe to pino-pretty or a log aggregator).
 *
 * Log levels (lowest → highest): trace | debug | info | warn | error | fatal
 * Override at runtime with the LOG_LEVEL env-var.
 */
const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',

    // In production emit raw JSON; in dev use pino-pretty for readability
    transport:
        process.env.NODE_ENV !== 'production'
            ? {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      translateTime: 'SYS:HH:MM:ss',
                      ignore: 'pid,hostname',
                  },
              }
            : undefined,
});

export default logger;
