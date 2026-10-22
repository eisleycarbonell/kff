import { pinoHttp } from 'pino-http';
import logger from '../utils/logger.ts';

/**
 * HTTP request/response logger middleware powered by pino-http.
 *
 * Automatically logs on every response:
 *   - HTTP method, URL, status code, response time, remote IP
 *
 * Usage:  app.use(httpLogger);
 */
const httpLogger = pinoHttp({
    logger,

    // Redact sensitive fields from the log output
    redact: ['req.headers.authorization', 'req.headers.cookie', "res.headers['set-cookie']"],

    // Customise the log level based on the response status code
    customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    // What to include in the serialised request object
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
                ip: req.remoteAddress,
            };
        },
        res(res) {
            return { statusCode: res.statusCode };
        },
    },
});

export default httpLogger;
