// ============================================================
// ENUMS
// ============================================================

export type LeadStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'MEETING'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST'
  | 'DISQUALIFIED';

export const LEAD_STATUS_VALUES: LeadStatus[] = [
  'NEW', 'QUALIFIED', 'CONTACTED', 'REPLIED',
  'MEETING', 'PROPOSAL', 'WON', 'LOST', 'DISQUALIFIED',
];

export type WebsiteStatus = 'UNCHECKED' | 'REACHABLE' | 'UNREACHABLE' | 'ERROR' | 'REDIRECT';

export type ActivityType =
  | 'LEAD_IMPORTED'
  | 'WEBSITE_AUDITED'
  | 'CONTACT_FOUND'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED'
  | 'MANUAL_ACTION'
  | 'AUDIT_FAILED';

export type AuditJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type OpportunityType =
  | 'WEBSITE_REDESIGN'
  | 'PERFORMANCE'
  | 'MOBILE'
  | 'SEO'
  | 'BOOKING'
  | 'WHATSAPP'
  | 'LEAD_CAPTURE'
  | 'AUTOMATION'
  | 'SOCIAL'
  | 'ACCESSIBILITY';

export type OpportunityPriority = 'HIGH' | 'MEDIUM' | 'LOW';

// ============================================================
// CORE DATA TYPES
// ============================================================

export interface Lead {
  id: number;
  business_name: string;
  normalized_name: string;
  category: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  source: string | null;
  source_url: string | null;
  website_status: WebsiteStatus;
  website_score: number | null;
  automation_score: number | null;
  lead_score: number | null;
  lead_status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_audited_at: string | null;
}

export interface WebsiteAudit {
  id: number;
  lead_id: number;
  url: string;
  reachable: boolean;
  http_status: number | null;
  final_url: string | null;
  https_enabled: boolean;
  mobile_friendly: boolean | null;
  load_time_ms: number | null;
  page_size_bytes: number | null;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  has_title: boolean;
  has_meta_description: boolean;
  has_h1: boolean;
  has_contact_form: boolean;
  has_booking: boolean;
  has_whatsapp: boolean;
  has_chat: boolean;
  has_clear_cta: boolean;
  has_instagram: boolean;
  has_facebook: boolean;
  has_linkedin: boolean;
  analytics_detected: boolean;
  meta_pixel_detected: boolean;
  cms_detected: string | null;
  issue_count: number;
  issues_json: string; // JSON string
  opportunities_json: string; // JSON string
  raw_metadata_json: string | null; // JSON string
  audited_at: string;
}

export interface Contact {
  id: number;
  lead_id: number;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  verified: boolean;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  lead_id: number;
  type: ActivityType;
  description: string;
  metadata_json: string | null;
  created_at: string;
}

export interface AuditJob {
  id: number;
  lead_id: number;
  status: AuditJobStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

// ============================================================
// OPPORTUNITY & SCORING TYPES
// ============================================================

export interface Opportunity {
  type: OpportunityType;
  title: string;
  reason: string;
  priority: OpportunityPriority;
}

export interface ScoreReason {
  label: string;
  points: number;
}

export interface LeadScore {
  total: number;
  reasons: ScoreReason[];
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface DashboardStats {
  total_leads: number;
  new_leads: number;
  qualified_leads: number;
  contacted_leads: number;
  websites_missing: number;
  websites_unreachable: number;
  website_opportunities: number;
  automation_opportunities: number;
  pipeline: Record<LeadStatus, number>;
  recent_audits: number;
}

// ============================================================
// CSV IMPORT TYPES
// ============================================================

export interface CsvRow {
  business_name: string;
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
}

export interface ImportPreview {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  ready_to_import: number;
  rows: ImportRowPreview[];
}

export interface ImportRowPreview {
  row_number: number;
  data: Partial<CsvRow>;
  status: 'VALID' | 'INVALID' | 'DUPLICATE';
  reason?: string;
}

export interface ImportResult {
  imported: number;
  skipped_duplicates: number;
  skipped_invalid: number;
  errors: string[];
}

// ============================================================
// LEAD SOURCE INTERFACES (for future extensibility)
// ============================================================

export interface LeadSourceResult {
  business_name: string;
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
  source: string;
  source_url?: string;
}

export interface LeadSource {
  readonly name: string;
  readonly description: string;
  /**
   * Search/fetch leads from this source.
   * Implementations: CSVSource, ManualSource, (future) GoogleMapsSource, ApolloSource
   */
  collect(params: Record<string, unknown>): Promise<LeadSourceResult[]>;
  /**
   * Normalize raw data from this source into canonical form.
   */
  normalize(raw: Record<string, unknown>): LeadSourceResult;
}

// ============================================================
// ENRICHMENT PROVIDER INTERFACES (for future extensibility)
// ============================================================

export interface EnrichmentResult {
  lead_id: number;
  enriched_fields: Partial<Lead>;
  confidence: number;
  source: string;
}

export interface EnrichmentProvider {
  readonly name: string;
  /**
   * Enrich a lead with additional information.
   * Implementations: (future) EmailEnrichmentProvider, SocialEnrichmentProvider
   * V1 implements: website-based enrichment only
   */
  enrich(lead: Lead): Promise<EnrichmentResult>;
}

// ============================================================
// AUDIT TYPES (parsed, not raw JSON)
// ============================================================

export interface AuditIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
}

export interface ParsedAudit extends Omit<WebsiteAudit, 'issues_json' | 'opportunities_json' | 'raw_metadata_json'> {
  issues: AuditIssue[];
  opportunities: Opportunity[];
  raw_metadata?: Record<string, unknown>;
}

// ============================================================
// PAGINATION
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface LeadFilters {
  search?: string;
  country?: string;
  city?: string;
  category?: string;
  lead_status?: LeadStatus;
  website_status?: WebsiteStatus;
  min_score?: number;
  max_score?: number;
  has_email?: boolean;
  has_phone?: boolean;
  has_instagram?: boolean;
  sort_by?: 'lead_score' | 'business_name' | 'created_at' | 'last_audited_at';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedLeads {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
