import express, { type Express } from 'express';
import userRouter from './routes/user.router.ts';
import httpLogger from './middleware/httpLogger.ts';
import logger from './utils/logger.ts';

const app: Express = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(httpLogger);        // HTTP request/response logging (must be first)
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/user', userRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
});
