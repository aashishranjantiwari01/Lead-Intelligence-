import type { LeadSource, LeadSourceResult } from '@lie/shared';
import { normalizeName, normalizeEmail, normalizePhone, normalizeCountry } from '../../utils/normalizeName';
import { normalizeUrl } from '../../utils/normalizeUrl';

/**
 * ManualSource — handles single lead creation from form input.
 * This is V1's implementation of the LeadSource interface for manual entry.
 * Future sources: GoogleMapsSource, ApolloSource, DirectorySource
 */
export class ManualSource implements LeadSource {
  readonly name = 'MANUAL';
  readonly description = 'Manual lead entry via the web interface';

  // Manual source doesn't have a search() equivalent — it's a single entry
  async collect(_params: Record<string, unknown>): Promise<LeadSourceResult[]> {
    // Not applicable for manual entry — return empty
    return [];
  }

  normalize(raw: Record<string, unknown>): LeadSourceResult {
    const business_name = String(raw.business_name ?? '').trim();
    if (!business_name) {
      throw new Error('business_name is required');
    }

    return {
      business_name,
      category: raw.category ? String(raw.category).trim() : undefined,
      country: raw.country ? normalizeCountry(String(raw.country)) ?? undefined : undefined,
      city: raw.city ? String(raw.city).trim() : undefined,
      address: raw.address ? String(raw.address).trim() : undefined,
      phone: raw.phone ? normalizePhone(String(raw.phone)) ?? undefined : undefined,
      email: raw.email ? normalizeEmail(String(raw.email)) ?? undefined : undefined,
      website: raw.website ? normalizeUrl(String(raw.website)) ?? undefined : undefined,
      instagram: raw.instagram ? String(raw.instagram).trim() : undefined,
      facebook: raw.facebook ? String(raw.facebook).trim() : undefined,
      linkedin: raw.linkedin ? String(raw.linkedin).trim() : undefined,
      source: 'MANUAL',
      source_url: raw.source_url ? String(raw.source_url).trim() : undefined,
    };
  }
}
