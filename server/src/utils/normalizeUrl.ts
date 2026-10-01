/**
 * URL normalization utilities.
 * Handles: adding https://, normalizing hostname casing, trailing slashes,
 * www consistency, and preserving meaningful paths.
 */

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^::1$/,             // IPv6 loopback (raw)
  /^\[::1\]$/,         // IPv6 loopback (bracketed — as returned by new URL())
  /^0\.0\.0\.0$/,
  /^169\.254\.\d+\.\d+$/, // link-local
  /^metadata\.google\.internal$/i,
  /^169\.254\.169\.254$/, // AWS metadata
];

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
}

export function normalizeUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Add scheme if missing — track whether original had an explicit scheme
  const hadExplicitScheme = /^https?:\/\//i.test(trimmed);
  let withScheme = trimmed;
  if (!hadExplicitScheme) {
    withScheme = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(withScheme);

    // Reject private/internal hosts
    if (isPrivateHost(parsed.hostname)) {
      return null;
    }

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Preserve original protocol — do NOT upgrade http → https
    // (The auditor needs to detect whether the site actually uses HTTPS)

    // Remove trailing slash from path if it's just the root
    let path = parsed.pathname;
    if (path !== '/') {
      path = path.replace(/\/+$/, '');
    } else {
      path = '';
    }

    // Reconstruct URL
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${path}${parsed.search}${parsed.hash}`;
    return normalized;
  } catch {
    return null;
  }
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    // Remove www. prefix for domain comparison
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export function isValidUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  try {
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}
