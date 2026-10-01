import { Router } from 'express';
import type { Request, Response } from 'express';
import { AuditJobRepository } from '../db/AuditJobRepository';
import { sendSuccess, sendError } from '../utils/response';
import { getQueueStats, getAllJobs, enqueueAudit } from '../services/auditQueue';

const router = Router();
const auditJobRepo = new AuditJobRepository();

// GET /api/audit-queue
router.get('/', (_req: Request, res: Response) => {
  const jobs = getAllJobs();
  const stats = getQueueStats();
  return sendSuccess(res, { jobs, stats });
});

// GET /api/audit-queue/stats
router.get('/stats', (_req: Request, res: Response) => {
  return sendSuccess(res, getQueueStats());
});

// POST /api/audit-queue/:jobId/retry
router.post('/:jobId/retry', (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) return sendError(res, 'INVALID_ID', 'Invalid job ID', 400);

  const job = auditJobRepo.findById(jobId);
  if (!job) return sendError(res, 'NOT_FOUND', 'Audit job not found', 404);

  if (job.status !== 'FAILED') {
    return sendError(res, 'INVALID_STATE', 'Only failed jobs can be retried', 400);
  }

  const result = enqueueAudit(job.lead_id);
  return sendSuccess(res, result);
});

export default router;
