import { Router } from 'express';
import type { Request, Response } from 'express';
import { LeadRepository } from '../db/LeadRepository';
import { ActivityRepository } from '../db/ActivityRepository';
import { AuditRepository } from '../db/AuditRepository';
import { sendSuccess, sendError } from '../utils/response';
import { CreateLeadSchema, UpdateLeadSchema, LeadFiltersSchema, AddNoteSchema, BatchAuditSchema } from '../validators/schemas';
import { normalizeName, normalizeEmail, normalizePhone, normalizeCountry } from '../utils/normalizeName';
import { normalizeUrl } from '../utils/normalizeUrl';
import { enqueueAudit, enqueueBatchAudit } from '../services/auditQueue';
import { logger } from '../utils/logger';
import multer from 'multer';
import { CsvImportService } from '../services/csvImportService';

const router = Router();
const leadRepo = new LeadRepository();
const activityRepo = new ActivityRepository();
const auditRepo = new AuditRepository();
const csvService = new CsvImportService();

// Multer for in-memory CSV uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── IMPORTANT: Specific routes MUST come before /:id routes ─────────────────

// ── GET /api/leads ─────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const parsed = LeadFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid filter parameters', 400, parsed.error.flatten());
  }
  const result = leadRepo.findAll(parsed.data as Parameters<typeof leadRepo.findAll>[0]);
  return sendSuccess(res, result);
});

// ── POST /api/leads ────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid lead data', 400, parsed.error.flatten());
  }

  const data = parsed.data;
  const normalizedWebsite = normalizeUrl(data.website ?? null);

  try {
    const lead = leadRepo.create({
      business_name: data.business_name,
      normalized_name: normalizeName(data.business_name),
      category: data.category,
      country: normalizeCountry(data.country ?? null) ?? undefined,
      city: data.city,
      address: data.address,
      phone: normalizePhone(data.phone ?? null) ?? undefined,
      email: normalizeEmail(data.email ?? null) ?? undefined,
      website: normalizedWebsite ?? undefined,
      instagram: data.instagram,
      facebook: data.facebook,
      linkedin: data.linkedin,
      source: data.source || 'MANUAL',
      source_url: data.source_url,
      lead_status: data.lead_status,
      notes: data.notes,
    });

    activityRepo.create(lead.id, 'LEAD_IMPORTED', `Lead created manually: ${data.business_name}`);
    logger.info({ leadId: lead.id }, 'Lead created via API');
    return sendSuccess(res, lead, 201);
  } catch (err) {
    logger.error({ err }, 'Failed to create lead');
    return sendError(res, 'DATABASE_ERROR', 'Failed to create lead', 500);
  }
});

// ── POST /api/leads/import (CSV) — BEFORE /:id ────────────────────────────
router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return sendError(res, 'NO_FILE', 'No CSV file provided', 400);
  }

  const action = (req.query.action as string) || 'preview';

  try {
    if (action === 'preview') {
      const preview = csvService.preview(req.file.buffer);
      return sendSuccess(res, preview);
    } else if (action === 'import') {
      const result = csvService.import(req.file.buffer);
      logger.info(result, 'CSV import completed via API');
      return sendSuccess(res, result);
    } else {
      return sendError(res, 'INVALID_ACTION', 'action must be "preview" or "import"', 400);
    }
  } catch (err) {
    logger.error({ err }, 'CSV import failed');
    return sendError(res, 'IMPORT_ERROR', `Import failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

// ── POST /api/leads/audit-batch — BEFORE /:id ─────────────────────────────
router.post('/audit-batch', (req: Request, res: Response) => {
  const parsed = BatchAuditSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid batch audit data', 400, parsed.error.flatten());
  }

  const result = enqueueBatchAudit(parsed.data.lead_ids);
  return sendSuccess(res, result, 202);
});

// ── GET /api/leads/export/csv — BEFORE /:id ───────────────────────────────
router.get('/export/csv', (req: Request, res: Response) => {
  const parsed = LeadFiltersSchema.safeParse(req.query);
  const filters = parsed.success ? parsed.data as Parameters<typeof leadRepo.findAll>[0] : {};

  const { leads } = leadRepo.findAll({ ...filters, limit: 10000 } as Parameters<typeof leadRepo.findAll>[0]);

  const FIELDS = [
    'business_name', 'category', 'country', 'city', 'website',
    'email', 'phone', 'instagram', 'website_status',
    'website_score', 'automation_score', 'lead_score', 'lead_status', 'notes',
  ] as const;

  const header = FIELDS.join(',');
  const rows = leads.map(lead => {
    return FIELDS.map(f => {
      const val = String(lead[f] ?? '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });

  const csv = [header, ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');
  return res.send(csv);
});

// ── GET /api/leads/:id ─────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const lead = leadRepo.findById(id);
  if (!lead) return sendError(res, 'NOT_FOUND', 'Lead not found', 404);

  return sendSuccess(res, lead);
});

// ── PUT /api/leads/:id ─────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const existing = leadRepo.findById(id);
  if (!existing) return sendError(res, 'NOT_FOUND', 'Lead not found', 404);

  const parsed = UpdateLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid update data', 400, parsed.error.flatten());
  }

  const data = parsed.data;

  // Track status change
  if (data.lead_status && data.lead_status !== existing.lead_status) {
    activityRepo.create(
      id,
      'STATUS_CHANGED',
      `Status changed from ${existing.lead_status} to ${data.lead_status}`,
      { from: existing.lead_status, to: data.lead_status }
    );
  }

  const updated = leadRepo.update(id, {
    ...data,
    ...(data.business_name ? { normalized_name: normalizeName(data.business_name) } : {}),
    ...(data.website !== undefined ? { website: normalizeUrl(data.website) ?? undefined } : {}),
    ...(data.email !== undefined ? { email: normalizeEmail(data.email) ?? undefined } : {}),
    ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) ?? undefined } : {}),
  } as Parameters<typeof leadRepo.update>[1]);

  return sendSuccess(res, updated);
});

// ── DELETE /api/leads/:id ──────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const deleted = leadRepo.delete(id);
  if (!deleted) return sendError(res, 'NOT_FOUND', 'Lead not found', 404);

  return sendSuccess(res, { deleted: true });
});

// ── POST /api/leads/:id/audit ──────────────────────────────────────────────
router.post('/:id/audit', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const lead = leadRepo.findById(id);
  if (!lead) return sendError(res, 'NOT_FOUND', 'Lead not found', 404);

  try {
    const result = enqueueAudit(id);
    return sendSuccess(res, result, 202);
  } catch (err) {
    return sendError(res, 'QUEUE_ERROR', `Failed to enqueue audit: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
});

// ── GET /api/leads/:id/audit ───────────────────────────────────────────────
router.get('/:id/audit', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const audits = auditRepo.findAllByLeadId(id);
  const parsed = audits.map(a => auditRepo.parsedAudit(a));
  return sendSuccess(res, parsed);
});

// ── POST /api/leads/:id/notes ──────────────────────────────────────────────
router.post('/:id/notes', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const lead = leadRepo.findById(id);
  if (!lead) return sendError(res, 'NOT_FOUND', 'Lead not found', 404);

  const parsed = AddNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'VALIDATION_ERROR', 'Invalid note data', 400, parsed.error.flatten());
  }

  // Append note to lead notes field
  const newNotes = lead.notes ? `${lead.notes}\n\n${parsed.data.note}` : parsed.data.note;
  leadRepo.update(id, { notes: newNotes });

  activityRepo.create(id, 'NOTE_ADDED', `Note added: ${parsed.data.note.slice(0, 100)}${parsed.data.note.length > 100 ? '...' : ''}`);

  return sendSuccess(res, { note_added: true });
});

export default router;
