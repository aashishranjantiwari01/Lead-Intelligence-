import { getDb } from '../config/database';
import { logger } from '../utils/logger';

export function runMigrations(): void {
  const db = getDb();
  logger.info('Running database migrations...');

  db.exec(`
    -- LEADS TABLE
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      category TEXT,
      country TEXT,
      city TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      instagram TEXT,
      facebook TEXT,
      linkedin TEXT,
      source TEXT,
      source_url TEXT,
      website_status TEXT NOT NULL DEFAULT 'UNCHECKED',
      website_score INTEGER,
      automation_score INTEGER,
      lead_score INTEGER,
      lead_status TEXT NOT NULL DEFAULT 'NEW',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_audited_at TEXT
    );

    -- WEBSITE_AUDITS TABLE
    CREATE TABLE IF NOT EXISTS website_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      reachable INTEGER NOT NULL DEFAULT 0,
      http_status INTEGER,
      final_url TEXT,
      https_enabled INTEGER NOT NULL DEFAULT 0,
      mobile_friendly INTEGER,
      load_time_ms INTEGER,
      page_size_bytes INTEGER,
      performance_score INTEGER,
      seo_score INTEGER,
      accessibility_score INTEGER,
      best_practices_score INTEGER,
      has_title INTEGER NOT NULL DEFAULT 0,
      has_meta_description INTEGER NOT NULL DEFAULT 0,
      has_h1 INTEGER NOT NULL DEFAULT 0,
      has_contact_form INTEGER NOT NULL DEFAULT 0,
      has_booking INTEGER NOT NULL DEFAULT 0,
      has_whatsapp INTEGER NOT NULL DEFAULT 0,
      has_chat INTEGER NOT NULL DEFAULT 0,
      has_clear_cta INTEGER NOT NULL DEFAULT 0,
      has_instagram INTEGER NOT NULL DEFAULT 0,
      has_facebook INTEGER NOT NULL DEFAULT 0,
      has_linkedin INTEGER NOT NULL DEFAULT 0,
      analytics_detected INTEGER NOT NULL DEFAULT 0,
      meta_pixel_detected INTEGER NOT NULL DEFAULT 0,
      cms_detected TEXT,
      issue_count INTEGER NOT NULL DEFAULT 0,
      issues_json TEXT NOT NULL DEFAULT '[]',
      opportunities_json TEXT NOT NULL DEFAULT '[]',
      raw_metadata_json TEXT,
      audited_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- CONTACTS TABLE
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      name TEXT,
      role TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      confidence INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- ACTIVITIES TABLE
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- AUDIT_JOBS TABLE
    CREATE TABLE IF NOT EXISTS audit_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- SETTINGS TABLE
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_leads_normalized_name ON leads(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
    CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
    CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON leads(lead_status);
    CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
    CREATE INDEX IF NOT EXISTS idx_website_audits_lead_id ON website_audits(lead_id);
    CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
    CREATE INDEX IF NOT EXISTS idx_audit_jobs_lead_id ON audit_jobs(lead_id);
    CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);
  `);

  // Insert default settings
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  insertSetting.run('audit_timeout_ms', '15000');
  insertSetting.run('max_concurrent_audits', '3');
  insertSetting.run('default_country', 'Switzerland');
  insertSetting.run('default_lead_status', 'NEW');

  logger.info('Database migrations completed');
}
