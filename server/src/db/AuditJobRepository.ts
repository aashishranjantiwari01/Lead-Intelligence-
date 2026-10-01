import { getDb } from '../config/database';
import type { AuditJob, AuditJobStatus } from '@lie/shared';

function rowToJob(row: Record<string, unknown>): AuditJob {
  return {
    id: row.id as number,
    lead_id: row.lead_id as number,
    status: row.status as AuditJobStatus,
    started_at: row.started_at as string | null,
    completed_at: row.completed_at as string | null,
    error_message: row.error_message as string | null,
  };
}

export class AuditJobRepository {
  findById(id: number): AuditJob | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM audit_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToJob(row) : null;
  }

  findByLeadId(leadId: number): AuditJob[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM audit_jobs WHERE lead_id = ? ORDER BY id DESC'
    ).all(leadId) as Record<string, unknown>[];
    return rows.map(rowToJob);
  }

  findByStatus(status: AuditJobStatus): AuditJob[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM audit_jobs WHERE status = ? ORDER BY id ASC'
    ).all(status) as Record<string, unknown>[];
    return rows.map(rowToJob);
  }

  findAll(): AuditJob[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM audit_jobs ORDER BY id DESC LIMIT 200'
    ).all() as Record<string, unknown>[];
    return rows.map(rowToJob);
  }

  hasActiveJob(leadId: number): boolean {
    const db = getDb();
    const row = db.prepare(
      "SELECT id FROM audit_jobs WHERE lead_id = ? AND status IN ('PENDING', 'RUNNING') LIMIT 1"
    ).get(leadId) as { id: number } | undefined;
    return !!row;
  }

  create(leadId: number): AuditJob {
    const db = getDb();
    const result = db.prepare(
      "INSERT INTO audit_jobs (lead_id, status) VALUES (?, 'PENDING')"
    ).run(leadId);
    return this.findById(result.lastInsertRowid as number)!;
  }

  updateStatus(id: number, status: AuditJobStatus, errorMessage?: string): AuditJob {
    const db = getDb();
    if (status === 'RUNNING') {
      db.prepare(
        "UPDATE audit_jobs SET status = ?, started_at = datetime('now') WHERE id = ?"
      ).run(status, id);
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      db.prepare(
        "UPDATE audit_jobs SET status = ?, completed_at = datetime('now'), error_message = ? WHERE id = ?"
      ).run(status, errorMessage ?? null, id);
    } else {
      db.prepare('UPDATE audit_jobs SET status = ? WHERE id = ?').run(status, id);
    }
    return this.findById(id)!;
  }

  getQueueStats() {
    const db = getDb();
    const rows = db.prepare(
      'SELECT status, COUNT(*) as count FROM audit_jobs GROUP BY status'
    ).all() as { status: string; count: number }[];
    const stats: Record<string, number> = { PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
    rows.forEach(r => { stats[r.status] = r.count; });
    return stats;
  }
}
