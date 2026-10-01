import { AuditJobRepository } from '../db/AuditJobRepository';
import { AuditRepository } from '../db/AuditRepository';
import { LeadRepository } from '../db/LeadRepository';
import { ActivityRepository } from '../db/ActivityRepository';
import { runWebsiteAudit } from './websiteAuditService';
import { config } from '../config';
import { logger } from '../utils/logger';

const auditJobRepo = new AuditJobRepository();
const auditRepo = new AuditRepository();
const leadRepo = new LeadRepository();
const activityRepo = new ActivityRepository();

let isProcessing = false;
let runningCount = 0;

/**
 * Enqueue a single lead for auditing.
 * Returns immediately — processing happens in background.
 */
export function enqueueAudit(leadId: number): { job_id: number; message: string } {
  const lead = leadRepo.findById(leadId);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  if (auditJobRepo.hasActiveJob(leadId)) {
    return { job_id: -1, message: 'Lead already has an active audit job' };
  }

  const job = auditJobRepo.create(leadId);
  logger.info({ jobId: job.id, leadId }, 'Audit job enqueued');

  // Trigger processing without awaiting
  processQueue().catch(err => {
    logger.error({ err }, 'Audit queue processing error');
  });

  return { job_id: job.id, message: 'Audit job enqueued successfully' };
}

/**
 * Enqueue multiple leads for batch auditing.
 */
export function enqueueBatchAudit(leadIds: number[]): { enqueued: number[]; skipped: number[] } {
  const enqueued: number[] = [];
  const skipped: number[] = [];

  for (const leadId of leadIds) {
    try {
      const lead = leadRepo.findById(leadId);
      if (!lead) { skipped.push(leadId); continue; }
      if (auditJobRepo.hasActiveJob(leadId)) { skipped.push(leadId); continue; }
      auditJobRepo.create(leadId);
      enqueued.push(leadId);
    } catch {
      skipped.push(leadId);
    }
  }

  if (enqueued.length > 0) {
    processQueue().catch(err => logger.error({ err }, 'Batch queue processing error'));
  }

  return { enqueued, skipped };
}

/**
 * Process the queue sequentially up to maxConcurrentAudits.
 * V1 uses sequential processing for simplicity.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const pendingJobs = auditJobRepo.findByStatus('PENDING');
      if (pendingJobs.length === 0) break;
      if (runningCount >= config.maxConcurrentAudits) break;

      const job = pendingJobs[0];
      runningCount++;
      auditJobRepo.updateStatus(job.id, 'RUNNING');

      processJob(job.id, job.lead_id).finally(() => {
        runningCount--;
        // Continue processing after this job
        processQueue().catch(() => {});
      });
    }
  } finally {
    isProcessing = false;
  }
}

async function processJob(jobId: number, leadId: number): Promise<void> {
  logger.info({ jobId, leadId }, 'Processing audit job');

  try {
    const lead = leadRepo.findById(leadId);
    if (!lead) {
      auditJobRepo.updateStatus(jobId, 'FAILED', `Lead ${leadId} not found`);
      return;
    }

    const auditResult = await runWebsiteAudit(lead);

    // Save audit to DB
    auditRepo.create({
      lead_id: lead.id,
      url: auditResult.url || lead.website || '',
      reachable: auditResult.reachable,
      http_status: auditResult.http_status,
      final_url: auditResult.final_url,
      https_enabled: auditResult.https_enabled,
      mobile_friendly: auditResult.mobile_friendly,
      load_time_ms: auditResult.load_time_ms,
      page_size_bytes: auditResult.page_size_bytes,
      performance_score: auditResult.performance_score,
      seo_score: auditResult.seo_score,
      accessibility_score: auditResult.accessibility_score,
      best_practices_score: auditResult.best_practices_score,
      has_title: auditResult.has_title,
      has_meta_description: auditResult.has_meta_description,
      has_h1: auditResult.has_h1,
      has_contact_form: auditResult.has_contact_form,
      has_booking: auditResult.has_booking,
      has_whatsapp: auditResult.has_whatsapp,
      has_chat: auditResult.has_chat,
      has_clear_cta: auditResult.has_clear_cta,
      has_instagram: auditResult.has_instagram,
      has_facebook: auditResult.has_facebook,
      has_linkedin: auditResult.has_linkedin,
      analytics_detected: auditResult.analytics_detected,
      meta_pixel_detected: auditResult.meta_pixel_detected,
      cms_detected: auditResult.cms_detected,
      issues: auditResult.issues,
      opportunities: auditResult.opportunities,
      raw_metadata: auditResult.raw_metadata,
    });

    // Update lead with scores and audit timestamp
    leadRepo.update(leadId, {
      website_status: auditResult.reachable ? 'REACHABLE' : 'UNREACHABLE',
      website_score: auditResult.website_score,
      automation_score: auditResult.automation_score,
      lead_score: auditResult.lead_score,
      last_audited_at: new Date().toISOString(),
    });

    // Record activity
    activityRepo.create(
      leadId,
      'WEBSITE_AUDITED',
      `Website audit completed — ${auditResult.opportunities.length} opportunities identified, lead score: ${auditResult.lead_score}`,
      {
        lead_score: auditResult.lead_score,
        opportunities: auditResult.opportunities.length,
        reachable: auditResult.reachable,
      }
    );

    auditJobRepo.updateStatus(jobId, 'COMPLETED');
    logger.info({ jobId, leadId, score: auditResult.lead_score }, 'Audit job completed');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId, leadId }, 'Audit job failed');
    auditJobRepo.updateStatus(jobId, 'FAILED', msg);

    // Record failure activity
    try {
      activityRepo.create(
        leadId,
        'AUDIT_FAILED',
        `Website audit failed: ${msg.slice(0, 200)}`,
        { error: msg }
      );
    } catch { /* Don't let activity creation crash */ }
  }
}

export function getQueueStats() {
  return auditJobRepo.getQueueStats();
}

export function getAllJobs() {
  return auditJobRepo.findAll();
}
