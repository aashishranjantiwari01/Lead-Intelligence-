import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import leadsRouter from './routes/leads';
import dashboardRouter from './routes/dashboard';
import activitiesRouter from './routes/activities';
import auditQueueRouter from './routes/auditQueue';
import settingsRouter from './routes/settings';
import type { Request, Response, NextFunction } from 'express';
import { sendError } from './utils/response';
import { logger } from './utils/logger';

const app = express();

// ── Security & CORS ─────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ─────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' } });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/leads', leadsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/audit-queue', auditQueueRouter);
app.use('/api/settings', settingsRouter);

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  sendError(res, 'NOT_FOUND', 'Endpoint not found', 404);
});

// ── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred', 500);
});

export default app;
