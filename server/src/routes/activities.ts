import { Router } from 'express';
import type { Request, Response } from 'express';
import { ActivityRepository } from '../db/ActivityRepository';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();
const activityRepo = new ActivityRepository();

router.get('/:leadId', (req: Request, res: Response) => {
  const leadId = parseInt(req.params.leadId, 10);
  if (isNaN(leadId)) return sendError(res, 'INVALID_ID', 'Invalid lead ID', 400);

  const activities = activityRepo.findByLeadId(leadId);
  return sendSuccess(res, activities);
});

export default router;
