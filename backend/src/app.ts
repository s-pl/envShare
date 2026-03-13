import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { organizationsRouter } from './routes/organizations';
import { secretsRouter } from './routes/secrets';
import { membersRouter } from './routes/members';
import { syncRouter } from './routes/sync';
import { auditRouter } from './routes/audit';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));

// Strict limit only on login/register to prevent brute-force
const loginLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });

app.use(globalLimiter);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use('/api/v1/auth/login',    loginLimiter);
app.use('/api/v1/auth/register', loginLimiter);
app.use('/api/v1/auth',          authRouter);
app.use('/api/v1/projects',      projectsRouter);
app.use('/api/v1/projects',      membersRouter);
app.use('/api/v1/organizations', organizationsRouter);
app.use('/api/v1/secrets',       secretsRouter);
app.use('/api/v1/sync',          syncRouter);
app.use('/api/v1/audit',         auditRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => logger.info(`envShare backend running on port ${PORT}`));

export default app;
