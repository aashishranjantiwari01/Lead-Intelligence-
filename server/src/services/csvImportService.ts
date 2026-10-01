import { parse } from 'csv-parse/sync';
import type { ImportPreview, ImportRowPreview, ImportResult, CsvRow } from '@lie/shared';
import { CsvRowSchema } from '../validators/schemas';
import { normalizeName, normalizeEmail, normalizePhone, assessDuplicateConfidence, type DuplicateSignal } from '../utils/normalizeName';
import { normalizeUrl, extractDomain } from '../utils/normalizeUrl';
import { LeadRepository } from '../db/LeadRepository';
import { ActivityRepository } from '../db/ActivityRepository';
import { logger } from '../utils/logger';
import { normalizeCountry } from '../utils/normalizeName';

// Case-insensitive column name mapping
const COLUMN_ALIASES: Record<string, keyof CsvRow> = {
  business_name: 'business_name',
  businessname: 'business_name',
  business: 'business_name',
  name: 'business_name',
  'company name': 'business_name',
  company: 'business_name',
  category: 'category',
  type: 'category',
  industry: 'category',
  country: 'country',
  city: 'city',
  town: 'city',
  location: 'city',
  address: 'address',
  street: 'address',
  phone: 'phone',
  telephone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  email: 'email',
  'e-mail': 'email',
  website: 'website',
  url: 'website',
  'website url': 'website',
  'web url': 'website',
  instagram: 'instagram',
  'instagram url': 'instagram',
  facebook: 'facebook',
  'facebook url': 'facebook',
  linkedin: 'linkedin',
  'linkedin url': 'linkedin',
  source: 'source',
  source_url: 'source_url',
  'source url': 'source_url',
};

function normalizeHeaders(headers: string[]): Record<number, keyof CsvRow | null> {
  const mapping: Record<number, keyof CsvRow | null> = {};
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, ' ');
    mapping[i] = COLUMN_ALIASES[key] ?? null;
  });
  return mapping;
}

export class CsvImportService {
  private leadRepo = new LeadRepository();
  private activityRepo = new ActivityRepository();

  parseBuffer(buffer: Buffer): { headers: string[]; rawRows: Record<string, string>[] } {
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      cast: false,
    }) as Record<string, string>[];

    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return { headers, rawRows: records };
  }

  private mapRow(raw: Record<string, string>): Partial<CsvRow> {
    const mapped: Partial<CsvRow> = {};
    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, ' ');
      const field = COLUMN_ALIASES[normalizedKey];
      if (field && value !== undefined) {
        (mapped as Record<string, string>)[field] = value.trim();
      }
    }
    return mapped;
  }

  preview(buffer: Buffer): ImportPreview {
    const { rawRows } = this.parseBuffer(buffer);
    const rows: ImportRowPreview[] = [];

    // Track normalized names+cities within this batch to catch intra-CSV duplicates
    const batchNormalizedNames = new Set<string>();
    const batchEmails = new Set<string>();
    const batchPhones = new Set<string>();
    const batchDomains = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const mapped = this.mapRow(rawRows[i]);
      const parsed = CsvRowSchema.safeParse(mapped);

      if (!parsed.success) {
        rows.push({
          row_number: i + 2, // +2 because header is row 1
          data: mapped,
          status: 'INVALID',
          reason: parsed.error.errors.map(e => e.message).join('; '),
        });
        continue;
      }

      const data = parsed.data;

      // Check for intra-CSV duplicate
      const nName = normalizeName(data.business_name);
      const city = (data.city || '').toLowerCase().trim();
      const batchKey = `${nName}|${city}`;
      const email = normalizeEmail(data.email);
      const phone = normalizePhone(data.phone);
      const domain = extractDomain(data.website);

      let isDuplicate = false;
      let dupReason = '';

      if (batchNormalizedNames.has(batchKey)) {
        isDuplicate = true;
        dupReason = 'Duplicate business name+city within CSV';
      } else if (email && batchEmails.has(email)) {
        isDuplicate = true;
        dupReason = 'Duplicate email within CSV';
      } else if (phone && batchPhones.has(phone)) {
        isDuplicate = true;
        dupReason = 'Duplicate phone within CSV';
      } else if (domain && batchDomains.has(domain)) {
        isDuplicate = true;
        dupReason = 'Duplicate website domain within CSV';
      }

      if (!isDuplicate) {
        // Check against existing DB
        const signals: DuplicateSignal[] = [];
        const existing = this.leadRepo.findByNormalizedNameAndCity(nName, data.city || null);
        if (existing.length > 0) {
          signals.push({
            type: 'NORMALIZED_NAME_CITY',
            confidence: 'HIGH',
            matchedId: existing[0].id,
            description: `Matches existing lead: "${existing[0].business_name}"`,
          });
        }
        if (email) {
          const existingByEmail = this.leadRepo.findByEmail(email);
          if (existingByEmail) {
            signals.push({
              type: 'EMAIL',
              confidence: 'HIGH',
              matchedId: existingByEmail.id,
              description: `Email matches existing lead: "${existingByEmail.business_name}"`,
            });
          }
        }
        if (phone) {
          const existingByPhone = this.leadRepo.findByPhone(phone);
          if (existingByPhone) {
            signals.push({
              type: 'PHONE',
              confidence: 'MEDIUM',
              matchedId: existingByPhone.id,
              description: `Phone matches existing lead: "${existingByPhone.business_name}"`,
            });
          }
        }
        if (domain) {
          const existingByDomain = this.leadRepo.findByWebsiteDomain(domain);
          if (existingByDomain.length > 0) {
            signals.push({
              type: 'WEBSITE_DOMAIN',
              confidence: 'MEDIUM',
              matchedId: existingByDomain[0].id,
              description: `Website domain matches existing lead: "${existingByDomain[0].business_name}"`,
            });
          }
        }
        const dupAssessment = assessDuplicateConfidence(signals);
        if (dupAssessment.isDuplicate) {
          isDuplicate = true;
          dupReason = signals.map(s => s.description).join('; ');
        }
      }

      if (isDuplicate) {
        rows.push({
          row_number: i + 2,
          data,
          status: 'DUPLICATE',
          reason: dupReason,
        });
        continue;
      }

      // Add to batch tracking sets
      batchNormalizedNames.add(batchKey);
      if (email) batchEmails.add(email);
      if (phone) batchPhones.add(phone);
      if (domain) batchDomains.add(domain);

      rows.push({
        row_number: i + 2,
        data,
        status: 'VALID',
      });
    }

    const valid = rows.filter(r => r.status === 'VALID').length;
    const invalid = rows.filter(r => r.status === 'INVALID').length;
    const duplicates = rows.filter(r => r.status === 'DUPLICATE').length;

    return {
      total_rows: rawRows.length,
      valid_rows: valid,
      invalid_rows: invalid,
      duplicate_rows: duplicates,
      ready_to_import: valid,
      rows,
    };
  }

  import(buffer: Buffer): ImportResult {
    const preview = this.preview(buffer);
    const result: ImportResult = {
      imported: 0,
      skipped_duplicates: preview.duplicate_rows,
      skipped_invalid: preview.invalid_rows,
      errors: [],
    };

    const validRows = preview.rows.filter(r => r.status === 'VALID');

    for (const row of validRows) {
      try {
        const data = row.data as CsvRow;
        const normalizedWebsite = normalizeUrl(data.website);
        const normalizedEmail = normalizeEmail(data.email) ?? undefined;
        const normalizedPhone = normalizePhone(data.phone) ?? undefined;
        const nName = normalizeName(data.business_name);

        const lead = this.leadRepo.create({
          business_name: data.business_name,
          normalized_name: nName,
          category: data.category,
          country: normalizeCountry(data.country) ?? undefined,
          city: data.city,
          address: data.address,
          phone: normalizedPhone,
          email: normalizedEmail,
          website: normalizedWebsite ?? undefined,
          instagram: data.instagram,
          facebook: data.facebook,
          linkedin: data.linkedin,
          source: data.source || 'CSV_IMPORT',
          source_url: data.source_url,
          lead_status: 'NEW',
        });

        this.activityRepo.create(
          lead.id,
          'LEAD_IMPORTED',
          `Lead imported from CSV: ${data.business_name}`,
          { source: 'CSV_IMPORT', row_number: row.row_number }
        );

        result.imported++;
        logger.debug({ leadId: lead.id, name: data.business_name }, 'Lead imported from CSV');
      } catch (err) {
        const msg = `Row ${row.row_number}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        logger.warn({ err, row }, 'Failed to import CSV row');
      }
    }

    logger.info(result, 'CSV import completed');
    return result;
  }
}
