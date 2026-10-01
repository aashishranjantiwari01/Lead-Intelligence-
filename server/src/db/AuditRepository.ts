import { getDb } from '../config/database';
import type { WebsiteAudit, ParsedAudit, Opportunity, AuditIssue } from '@lie/shared';

function rowToAudit(row: Record<string, unknown>): WebsiteAudit {
  return {
    id: row.id as number,
    lead_id: row.lead_id as number,
    url: row.url as string,
    reachable: Boolean(row.reachable),
    http_status: row.http_status as number | null,
    final_url: row.final_url as string | null,
    https_enabled: Boolean(row.https_enabled),
    mobile_friendly: row.mobile_friendly != null ? Boolean(row.mobile_friendly) : null,
    load_time_ms: row.load_time_ms as number | null,
    page_size_bytes: row.page_size_bytes as number | null,
    performance_score: row.performance_score as number | null,
    seo_score: row.seo_score as number | null,
    accessibility_score: row.accessibility_score as number | null,
    best_practices_score: row.best_practices_score as number | null,
    has_title: Boolean(row.has_title),
    has_meta_description: Boolean(row.has_meta_description),
    has_h1: Boolean(row.has_h1),
    has_contact_form: Boolean(row.has_contact_form),
    has_booking: Boolean(row.has_booking),
    has_whatsapp: Boolean(row.has_whatsapp),
    has_chat: Boolean(row.has_chat),
    has_clear_cta: Boolean(row.has_clear_cta),
    has_instagram: Boolean(row.has_instagram),
    has_facebook: Boolean(row.has_facebook),
    has_linkedin: Boolean(row.has_linkedin),
    analytics_detected: Boolean(row.analytics_detected),
    meta_pixel_detected: Boolean(row.meta_pixel_detected),
    cms_detected: row.cms_detected as string | null,
    issue_count: row.issue_count as number,
    issues_json: row.issues_json as string,
    opportunities_json: row.opportunities_json as string,
    raw_metadata_json: row.raw_metadata_json as string | null,
    audited_at: row.audited_at as string,
  };
}

export interface CreateAuditData {
  lead_id: number;
  url: string;
  reachable: boolean;
  http_status?: number | null;
  final_url?: string | null;
  https_enabled?: boolean;
  mobile_friendly?: boolean | null;
  load_time_ms?: number | null;
  page_size_bytes?: number | null;
  performance_score?: number | null;
  seo_score?: number | null;
  accessibility_score?: number | null;
  best_practices_score?: number | null;
  has_title?: boolean;
  has_meta_description?: boolean;
  has_h1?: boolean;
  has_contact_form?: boolean;
  has_booking?: boolean;
  has_whatsapp?: boolean;
  has_chat?: boolean;
  has_clear_cta?: boolean;
  has_instagram?: boolean;
  has_facebook?: boolean;
  has_linkedin?: boolean;
  analytics_detected?: boolean;
  meta_pixel_detected?: boolean;
  cms_detected?: string | null;
  issues: AuditIssue[];
  opportunities: Opportunity[];
  raw_metadata?: Record<string, unknown>;
}

export class AuditRepository {
  findLatestByLeadId(leadId: number): WebsiteAudit | null {
    const db = getDb();
    const row = db.prepare(
      'SELECT * FROM website_audits WHERE lead_id = ? ORDER BY audited_at DESC LIMIT 1'
    ).get(leadId) as Record<string, unknown> | undefined;
    return row ? rowToAudit(row) : null;
  }

  findAllByLeadId(leadId: number): WebsiteAudit[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM website_audits WHERE lead_id = ? ORDER BY audited_at DESC'
    ).all(leadId) as Record<string, unknown>[];
    return rows.map(rowToAudit);
  }

  create(data: CreateAuditData): WebsiteAudit {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO website_audits (
        lead_id, url, reachable, http_status, final_url, https_enabled,
        mobile_friendly, load_time_ms, page_size_bytes,
        performance_score, seo_score, accessibility_score, best_practices_score,
        has_title, has_meta_description, has_h1,
        has_contact_form, has_booking, has_whatsapp, has_chat, has_clear_cta,
        has_instagram, has_facebook, has_linkedin,
        analytics_detected, meta_pixel_detected, cms_detected,
        issue_count, issues_json, opportunities_json, raw_metadata_json
      ) VALUES (
        @lead_id, @url, @reachable, @http_status, @final_url, @https_enabled,
        @mobile_friendly, @load_time_ms, @page_size_bytes,
        @performance_score, @seo_score, @accessibility_score, @best_practices_score,
        @has_title, @has_meta_description, @has_h1,
        @has_contact_form, @has_booking, @has_whatsapp, @has_chat, @has_clear_cta,
        @has_instagram, @has_facebook, @has_linkedin,
        @analytics_detected, @meta_pixel_detected, @cms_detected,
        @issue_count, @issues_json, @opportunities_json, @raw_metadata_json
      )
    `);

    const result = stmt.run({
      lead_id: data.lead_id,
      url: data.url,
      reachable: data.reachable ? 1 : 0,
      http_status: data.http_status ?? null,
      final_url: data.final_url ?? null,
      https_enabled: data.https_enabled ? 1 : 0,
      mobile_friendly: data.mobile_friendly != null ? (data.mobile_friendly ? 1 : 0) : null,
      load_time_ms: data.load_time_ms ?? null,
      page_size_bytes: data.page_size_bytes ?? null,
      performance_score: data.performance_score ?? null,
      seo_score: data.seo_score ?? null,
      accessibility_score: data.accessibility_score ?? null,
      best_practices_score: data.best_practices_score ?? null,
      has_title: data.has_title ? 1 : 0,
      has_meta_description: data.has_meta_description ? 1 : 0,
      has_h1: data.has_h1 ? 1 : 0,
      has_contact_form: data.has_contact_form ? 1 : 0,
      has_booking: data.has_booking ? 1 : 0,
      has_whatsapp: data.has_whatsapp ? 1 : 0,
      has_chat: data.has_chat ? 1 : 0,
      has_clear_cta: data.has_clear_cta ? 1 : 0,
      has_instagram: data.has_instagram ? 1 : 0,
      has_facebook: data.has_facebook ? 1 : 0,
      has_linkedin: data.has_linkedin ? 1 : 0,
      analytics_detected: data.analytics_detected ? 1 : 0,
      meta_pixel_detected: data.meta_pixel_detected ? 1 : 0,
      cms_detected: data.cms_detected ?? null,
      issue_count: data.issues.length,
      issues_json: JSON.stringify(data.issues),
      opportunities_json: JSON.stringify(data.opportunities),
      raw_metadata_json: data.raw_metadata ? JSON.stringify(data.raw_metadata) : null,
    });

    const row = db.prepare('SELECT * FROM website_audits WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
    return rowToAudit(row);
  }

  parsedAudit(audit: WebsiteAudit): ParsedAudit {
    const { issues_json, opportunities_json, raw_metadata_json, ...rest } = audit;
    return {
      ...rest,
      issues: JSON.parse(issues_json) as AuditIssue[],
      opportunities: JSON.parse(opportunities_json) as Opportunity[],
      raw_metadata: raw_metadata_json ? JSON.parse(raw_metadata_json) as Record<string, unknown> : undefined,
    };
  }
}
