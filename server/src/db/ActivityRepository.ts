import { getDb } from '../config/database';
import type { Activity, ActivityType } from '@lie/shared';

function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as number,
    lead_id: row.lead_id as number,
    type: row.type as ActivityType,
    description: row.description as string,
    metadata_json: row.metadata_json as string | null,
    created_at: row.created_at as string,
  };
}

export class ActivityRepository {
  findByLeadId(leadId: number): Activity[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC'
    ).all(leadId) as Record<string, unknown>[];
    return rows.map(rowToActivity);
  }

  create(leadId: number, type: ActivityType, description: string, metadata?: Record<string, unknown>): Activity {
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO activities (lead_id, type, description, metadata_json) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(leadId, type, description, metadata ? JSON.stringify(metadata) : null);
    const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    return rowToActivity(row);
  }
}
