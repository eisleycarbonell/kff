import express, { type Express } from 'express';
import userRouter from './routes/user.router.ts';
import httpLogger from './middleware/httpLogger.ts';
import logger from './utils/logger.ts';
import cors from 'cors';

const app: Express = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(httpLogger);        // HTTP request/response logging (must be first)
app.use(express.json());
app.use(
    cors({
        origin: ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    })
);


// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/user', userRouter);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
});
