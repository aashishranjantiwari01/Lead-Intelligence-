import { Router } from 'express';
import type { Request, Response } from 'express';
import { LeadRepository } from '../db/LeadRepository';
import { sendSuccess } from '../utils/response';

const router = Router();
const leadRepo = new LeadRepository();

router.get('/stats', (_req: Request, res: Response) => {
  const stats = leadRepo.getDashboardStats();
  return sendSuccess(res, stats);
});

export default router;
