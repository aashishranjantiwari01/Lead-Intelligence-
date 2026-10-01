import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { SettingsUpdateSchema } from '../validators/schemas';

const router = Router();

function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).run(key, value);
}

router.get('/', (_req: Request, res: Response) => {
  const settings = {
    audit_timeout_ms: parseInt(getSetting('audit_timeout_ms') ?? '15000', 10),
    max_concurrent_audits: parseInt(getSetting('max_concurrent_audits') ?? '3', 10),
    default_country: getSetting('default_country') ?? 'Switzerland',
    default_lead_status: getSetting('default_lead_status') ?? 'NEW',
  };
  return sendSuccess(res, settings);
});

router.put('/', (req: Request, res: Response) => {
  const parsed = SettingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid settings data', 400, parsed.error.flatten());
  }

  const data = parsed.data;
  if (data.audit_timeout_ms !== undefined) setSetting('audit_timeout_ms', String(data.audit_timeout_ms));
  if (data.max_concurrent_audits !== undefined) setSetting('max_concurrent_audits', String(data.max_concurrent_audits));
  if (data.default_country !== undefined) setSetting('default_country', data.default_country);
  if (data.default_lead_status !== undefined) setSetting('default_lead_status', data.default_lead_status);

  return sendSuccess(res, { updated: true });
});

export default router;
