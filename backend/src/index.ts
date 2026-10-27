import 'dotenv/config';

import { createApp } from './app.ts';
import * as UserService from './modules/users/user.service.ts';
import logger from './utils/logger.ts';

const app = createApp(UserService);
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV ?? 'development' }, 'Server started');
});
