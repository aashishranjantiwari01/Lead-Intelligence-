/**
 * Business name normalization for duplicate detection.
 * Normalizes whitespace, casing, and common legal suffixes.
 */

// Legal/corporate suffixes to strip for comparison
const STRIP_SUFFIXES = [
  'gmbh', 'ag', 'llc', 'ltd', 'inc', 'corp', 'plc', 'bv', 'sa', 'sas',
  'sarl', 'oy', 'ab', 'as', 'aps', 'nv', 'sl', 'spa', 'srl', 'kg',
  'ohg', 'e.k.', 'ek', 'genossenschaft', 'gmbh & co. kg', 'gmbh & co kg',
];

export function normalizeName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';

  let normalized = name
    .trim()
    .toLowerCase()
    // Collapse multiple spaces/tabs/newlines
    .replace(/\s+/g, ' ')
    // Remove punctuation that doesn't help with matching
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip common legal suffixes from end
  for (const suffix of STRIP_SUFFIXES) {
    const pattern = new RegExp(`\\s+${escapeRegex(suffix)}\\s*$`, 'i');
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '').trim();
      break; // Only strip one suffix
    }
  }

  return normalized;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Strip all non-digit characters except leading +
  const stripped = phone.trim().replace(/[^\d+]/g, '');
  if (!stripped || stripped.length < 6) return null;

  return stripped;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeCountry(country: string | null | undefined): string | null {
  if (!country || typeof country !== 'string') return null;
  return country.trim();
}

export interface DuplicateSignal {
  type: 'NORMALIZED_NAME_CITY' | 'WEBSITE_DOMAIN' | 'PHONE' | 'EMAIL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedId?: number;
  description: string;
}

export function assessDuplicateConfidence(signals: DuplicateSignal[]): {
  isDuplicate: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  signals: DuplicateSignal[];
} {
  if (signals.length === 0) {
    return { isDuplicate: false, confidence: 'NONE', signals: [] };
  }

  const hasHigh = signals.some(s => s.confidence === 'HIGH');
  const count = signals.length;

  if (hasHigh || count >= 2) {
    return { isDuplicate: true, confidence: 'HIGH', signals };
  }

  return { isDuplicate: false, confidence: 'MEDIUM', signals };
}
