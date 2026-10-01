import dotenv from 'dotenv';
import path from 'path';

// Load .env from root of project (two levels up from server/src/config)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH || './data/app.db',
  auditTimeoutMs: parseInt(process.env.AUDIT_TIMEOUT_MS || '15000', 10),
  maxConcurrentAudits: parseInt(process.env.MAX_CONCURRENT_AUDITS || '3', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultCountry: process.env.DEFAULT_COUNTRY || 'Switzerland',
  defaultLeadStatus: process.env.DEFAULT_LEAD_STATUS || 'NEW',
};
