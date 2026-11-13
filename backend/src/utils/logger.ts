import { createRequire } from 'node:module';
import pino from 'pino';

const require = createRequire(import.meta.url);

function canResolvePrettyTransport(): boolean {
    if (
        process.env.NODE_ENV === 'production' ||
        Boolean(process.env.VERCEL) ||
        Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
    ) {
        return false;
    }

    try {
        require.resolve('pino-pretty');
        return true;
    } catch {
        return false;
    }
}

/**
 * Central Pino logger.
 *
 * In development:  pretty-prints to the terminal via pino-pretty when available.
 * In production/serverless: emits newline-delimited JSON.
 *
 * Log levels (lowest -> highest): trace | debug | info | warn | error | fatal
 * Override at runtime with the LOG_LEVEL env-var.
 */
const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',

    // In production, serverless, or prod-only installs emit raw JSON; in local dev use pino-pretty
    transport: canResolvePrettyTransport()
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
