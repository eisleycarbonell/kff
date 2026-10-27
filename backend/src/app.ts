import cors from 'cors';
import express from 'express';

import { AppError } from './errors/app-error.ts';
import { errorHandler } from './middleware/error-handler.ts';
import httpLogger from './middleware/httpLogger.ts';
import type { UserService } from './modules/users/user.controller.ts';
import { createUserRouter } from './modules/users/user.routes.ts';
import HttpStatusCode from './utils/statusCodeHandler.ts';

/** Build the HTTP app without opening a port or importing a live database client. */
export function createApp(userService: UserService) {
    const app = express();

    app.use(httpLogger);
    app.use(
        cors({
            origin: ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        }),
    );
    app.use(express.json());

    app.use('/api/user', createUserRouter(userService));
    app.use((_request, _response, next) => {
        next(new AppError(HttpStatusCode.NOT_FOUND, 'Route not found.'));
    });
    app.use(errorHandler);

    return app;
}
