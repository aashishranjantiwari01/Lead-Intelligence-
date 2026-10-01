/**
 * URL normalization utilities.
 * Handles: adding https://, normalizing hostname casing, trailing slashes,
 * www consistency, and preserving meaningful paths.
 */

// Re-export the canonical SSRF host-classification from ssrfGuard.
// ssrfGuard.ts is the ONE source of truth for private-host detection.
export { isPrivateHost, isPrivateIp } from './ssrfGuard';
import { isPrivateHost } from './ssrfGuard';


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
