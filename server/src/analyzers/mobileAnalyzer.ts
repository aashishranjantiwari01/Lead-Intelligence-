import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface MobileAnalysisResult {
  mobile_friendly: boolean;
  has_viewport_meta: boolean;
  has_horizontal_overflow: boolean;
  issues: AuditIssue[];
}

/**
 * Mobile heuristic analyzer.
 * NOTE: This is a heuristic check, NOT a complete device compatibility test.
 * Results are labeled as "Mobile heuristic" to avoid misleading claims.
 */
export async function analyzeMobile(page: Page): Promise<MobileAnalysisResult> {
  const issues: AuditIssue[] = [];

  const has_viewport_meta = await page.locator('meta[name="viewport"]').count().then(c => c > 0).catch(() => false);

  // Check for horizontal overflow (simplified heuristic)
  let has_horizontal_overflow = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    has_horizontal_overflow = await page.evaluate(() => (document as any).body.scrollWidth > (document as any).documentElement.clientWidth);
  } catch {
    // Ignore evaluation errors
  }

  // Check for fixed-width containers (heuristic)
  let hasFixedWidth = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hasFixedWidth = await page.evaluate(() => {
      // @ts-ignore — runs in browser context
      const elements = (document as any).querySelectorAll('[style*="width"]');
      for (const el of Array.from(elements)) {
        const style = (el as any).style?.width;
        if (style && /^\d+px$/.test(style) && parseInt(style) > 768) {
          return true;
        }
      }
      return false;
    });
  } catch {
    // Ignore
  }

  if (!has_viewport_meta) {
    issues.push({
      severity: 'HIGH',
      category: 'Mobile',
      description: 'No viewport meta tag detected — mobile heuristic indicates potential mobile layout issues',
    });
  }

  if (has_horizontal_overflow) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Mobile',
      description: 'Horizontal overflow detected at mobile viewport width — mobile heuristic indicates layout issue',
    });
  }

  if (hasFixedWidth) {
    issues.push({
      severity: 'LOW',
      category: 'Mobile',
      description: 'Fixed-width elements detected — mobile heuristic suggests possible responsive layout issues',
    });
  }

  const mobile_friendly = has_viewport_meta && !has_horizontal_overflow && !hasFixedWidth;

  return {
    mobile_friendly,
    has_viewport_meta,
    has_horizontal_overflow,
    issues,
  };
}
