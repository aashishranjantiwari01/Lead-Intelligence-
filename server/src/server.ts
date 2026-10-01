import { initDb } from './config/database';
import { runMigrations } from './db/schema';
import { config } from './config';
import { logger } from './utils/logger';
import { closeBrowser } from './services/websiteAuditService';
import app from './app';

async function start() {
  // Initialize database
  initDb();
  runMigrations();

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`Lead Intelligence Engine server started on http://localhost:${config.port}`);
    logger.info(`CORS allowed for: ${config.clientUrl}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    server.close(() => {
      closeBrowser().then(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    // Don't exit — keep server running for local dev
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
