import { getDb } from '../config/database';
import type { Lead, LeadFilters, PaginatedLeads, LeadStatus, WebsiteStatus } from '@lie/shared';

// SQLite stores booleans as 0/1 integers — convert back to proper types
function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as number,
    business_name: row.business_name as string,
    normalized_name: row.normalized_name as string,
    category: row.category as string | null,
    country: row.country as string | null,
    city: row.city as string | null,
    address: row.address as string | null,
    phone: row.phone as string | null,
    email: row.email as string | null,
    website: row.website as string | null,
    instagram: row.instagram as string | null,
    facebook: row.facebook as string | null,
    linkedin: row.linkedin as string | null,
    source: row.source as string | null,
    source_url: row.source_url as string | null,
    website_status: (row.website_status as WebsiteStatus) || 'UNCHECKED',
    website_score: row.website_score as number | null,
    automation_score: row.automation_score as number | null,
    lead_score: row.lead_score as number | null,
    lead_status: (row.lead_status as LeadStatus) || 'NEW',
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    last_audited_at: row.last_audited_at as string | null,
  };
}

export interface CreateLeadData {
  business_name: string;
  normalized_name: string;
  category?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  source?: string;
  source_url?: string;
  lead_status?: LeadStatus;
  notes?: string;
}

export interface UpdateLeadData {
  business_name?: string;
  normalized_name?: string;
  category?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  source?: string | null;
  source_url?: string | null;
  website_status?: WebsiteStatus;
  website_score?: number | null;
  automation_score?: number | null;
  lead_score?: number | null;
  lead_status?: LeadStatus;
  notes?: string | null;
  last_audited_at?: string | null;
}

export class LeadRepository {
  findById(id: number): Lead | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToLead(row) : null;
  }

  findAll(filters: LeadFilters = {}): PaginatedLeads {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.search) {
      conditions.push('(business_name LIKE ? OR city LIKE ? OR website LIKE ? OR email LIKE ?)');
      const q = `%${filters.search}%`;
      params.push(q, q, q, q);
    }
    if (filters.country) {
      conditions.push('country = ?');
      params.push(filters.country);
    }
    if (filters.city) {
      conditions.push('city LIKE ?');
      params.push(`%${filters.city}%`);
    }
    if (filters.category) {
      conditions.push('category LIKE ?');
      params.push(`%${filters.category}%`);
    }
    if (filters.lead_status) {
      conditions.push('lead_status = ?');
      params.push(filters.lead_status);
    }
    if (filters.website_status) {
      conditions.push('website_status = ?');
      params.push(filters.website_status);
    }
    if (filters.min_score !== undefined) {
      conditions.push('lead_score >= ?');
      params.push(filters.min_score);
    }
    if (filters.max_score !== undefined) {
      conditions.push('lead_score <= ?');
      params.push(filters.max_score);
    }
    if (filters.has_email) {
      conditions.push('email IS NOT NULL AND email != ""');
    }
    if (filters.has_phone) {
      conditions.push('phone IS NOT NULL AND phone != ""');
    }
    if (filters.has_instagram) {
      conditions.push('instagram IS NOT NULL AND instagram != ""');
    }
    // has_website=false → leads with no website URL (NULL or empty string)
    // has_website=true  → leads that have a website URL
    // NOTE: this checks the actual lead.website field, NOT the audit/website_status
    if (filters.has_website === false) {
      conditions.push("(website IS NULL OR website = '')");
    } else if (filters.has_website === true) {
      conditions.push("website IS NOT NULL AND website != ''");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM leads ${where}`).get(...params) as { count: number };
    const total = countRow.count;

    // Sort
    const sortColumn = filters.sort_by || 'created_at';
    const sortOrder = filters.sort_order || 'desc';
    const validSortColumns = ['lead_score', 'business_name', 'created_at', 'last_audited_at'];
    const safeSortColumn = validSortColumns.includes(sortColumn) ? sortColumn : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Pagination — honor caller-supplied page and limit
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 100));

    const rows = db.prepare(
      `SELECT * FROM leads ${where} ORDER BY ${safeSortColumn} ${safeSortOrder} LIMIT ? OFFSET ?`
    ).all(...params, limit, (page - 1) * limit) as Record<string, unknown>[];

    return {
      leads: rows.map(rowToLead),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  create(data: CreateLeadData): Lead {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO leads (
        business_name, normalized_name, category, country, city, address,
        phone, email, website, instagram, facebook, linkedin,
        source, source_url, lead_status, notes
      ) VALUES (
        @business_name, @normalized_name, @category, @country, @city, @address,
        @phone, @email, @website, @instagram, @facebook, @linkedin,
        @source, @source_url, @lead_status, @notes
      )
    `);

    const result = stmt.run({
      business_name: data.business_name,
      normalized_name: data.normalized_name,
      category: data.category ?? null,
      country: data.country ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      instagram: data.instagram ?? null,
      facebook: data.facebook ?? null,
      linkedin: data.linkedin ?? null,
      source: data.source ?? null,
      source_url: data.source_url ?? null,
      lead_status: data.lead_status ?? 'NEW',
      notes: data.notes ?? null,
    });

    const lead = this.findById(result.lastInsertRowid as number);
    if (!lead) throw new Error('Failed to retrieve created lead');
    return lead;
  }

  update(id: number, data: UpdateLeadData): Lead | null {
    const db = getDb();
    const fields = Object.keys(data) as (keyof UpdateLeadData)[];
    if (fields.length === 0) return this.findById(id);

    const setClauses = fields.map(f => `${f} = @${f}`).join(', ');
    const stmt = db.prepare(
      `UPDATE leads SET ${setClauses}, updated_at = datetime('now') WHERE id = @id`
    );
    stmt.run({ ...data, id });
    return this.findById(id);
  }

  delete(id: number): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Duplicate detection
  findByNormalizedNameAndCity(normalizedName: string, city: string | null): Lead[] {
    const db = getDb();
    let rows: Record<string, unknown>[];
    if (city) {
      rows = db.prepare(
        'SELECT * FROM leads WHERE normalized_name = ? AND (city = ? OR city IS NULL)'
      ).all(normalizedName, city) as Record<string, unknown>[];
    } else {
      rows = db.prepare(
        'SELECT * FROM leads WHERE normalized_name = ?'
      ).all(normalizedName) as Record<string, unknown>[];
    }
    return rows.map(rowToLead);
  }

  findByWebsiteDomain(domain: string): Lead[] {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM leads WHERE website LIKE ? OR website LIKE ? OR website LIKE ? OR website LIKE ?"
    ).all(
      `%${domain}%`,
      `%www.${domain}%`,
      `%${domain}/%`,
      `%www.${domain}/%`
    ) as Record<string, unknown>[];
    return rows.map(rowToLead);
  }

  findByPhone(phone: string): Lead | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone) as Record<string, unknown> | undefined;
    return row ? rowToLead(row) : null;
  }

  findByEmail(email: string): Lead | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM leads WHERE email = ?').get(email) as Record<string, unknown> | undefined;
    return row ? rowToLead(row) : null;
  }

  getDashboardStats() {
    const db = getDb();

    const total = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number }).c;
    const byStatus = db.prepare('SELECT lead_status, COUNT(*) as c FROM leads GROUP BY lead_status').all() as { lead_status: string; c: number }[];

    const statusMap: Record<string, number> = {};
    byStatus.forEach(r => { statusMap[r.lead_status] = r.c; });

    // Leads with no website URL (null or empty string) — NOT proxied by audit status
    const missingWebsite = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE (website IS NULL OR website = '')").get() as { c: number }).c;
    const unreachable = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE website_status = 'UNREACHABLE'").get() as { c: number }).c;

    // Distinct leads that have at least one opportunity of any type in their audits
    const hasOpportunities = (db.prepare(`
      SELECT COUNT(DISTINCT lead_id) as c FROM website_audits 
      WHERE opportunities_json != '[]' AND opportunities_json IS NOT NULL
    `).get() as { c: number }).c;

    // Distinct leads with at least one AUTOMATION-type opportunity
    // (AUTOMATION, WHATSAPP, BOOKING, LEAD_CAPTURE)
    // SQLite: JSON stored as text — we search for the type strings inside the JSON array
    const automationOpportunities = (db.prepare(`
      SELECT COUNT(DISTINCT lead_id) as c FROM website_audits
      WHERE opportunities_json IS NOT NULL
        AND (
          opportunities_json LIKE '%"type":"AUTOMATION"%'
          OR opportunities_json LIKE '%"type":"WHATSAPP"%'
          OR opportunities_json LIKE '%"type":"BOOKING"%'
          OR opportunities_json LIKE '%"type":"LEAD_CAPTURE"%'
        )
    `).get() as { c: number }).c;

    const recentAudits = (db.prepare(`
      SELECT COUNT(*) as c FROM website_audits 
      WHERE audited_at >= datetime('now', '-7 days')
    `).get() as { c: number }).c;

    return {
      total_leads: total,
      new_leads: statusMap['NEW'] ?? 0,
      qualified_leads: statusMap['QUALIFIED'] ?? 0,
      contacted_leads: statusMap['CONTACTED'] ?? 0,
      websites_missing: missingWebsite,
      websites_unreachable: unreachable,
      website_opportunities: hasOpportunities,
      automation_opportunities: automationOpportunities,
      pipeline: {
        NEW: statusMap['NEW'] ?? 0,
        QUALIFIED: statusMap['QUALIFIED'] ?? 0,
        CONTACTED: statusMap['CONTACTED'] ?? 0,
        REPLIED: statusMap['REPLIED'] ?? 0,
        MEETING: statusMap['MEETING'] ?? 0,
        PROPOSAL: statusMap['PROPOSAL'] ?? 0,
        WON: statusMap['WON'] ?? 0,
        LOST: statusMap['LOST'] ?? 0,
        DISQUALIFIED: statusMap['DISQUALIFIED'] ?? 0,
      },
      recent_audits: recentAudits,
    };
  }
}
