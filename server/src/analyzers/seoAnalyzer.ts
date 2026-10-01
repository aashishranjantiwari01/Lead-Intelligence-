import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface SeoAnalysisResult {
  has_title: boolean;
  title_length: number | null;
  has_meta_description: boolean;
  meta_description_length: number | null;
  has_h1: boolean;
  h1_count: number;
  has_canonical: boolean;
  has_viewport_meta: boolean;
  has_robots_meta: boolean;
  seo_score: number;
  issues: AuditIssue[];
}

export async function analyzeSeo(page: Page): Promise<SeoAnalysisResult> {
  const issues: AuditIssue[] = [];

  const title = await page.title().catch(() => '');
  const has_title = title.length > 0;
  const title_length = has_title ? title.length : null;

  const metaDescription = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
  const has_meta_description = !!metaDescription && metaDescription.trim().length > 0;
  const meta_description_length = has_meta_description ? metaDescription!.trim().length : null;

  const h1s = await page.locator('h1').count().catch(() => 0);
  const has_h1 = h1s > 0;
  const h1_count = h1s;

  const canonical = await page.locator('link[rel="canonical"]').count().catch(() => 0);
  const has_canonical = canonical > 0;

  const viewport = await page.locator('meta[name="viewport"]').count().catch(() => 0);
  const has_viewport_meta = viewport > 0;

  const robots = await page.locator('meta[name="robots"]').count().catch(() => 0);
  const has_robots_meta = robots > 0;

  // Score calculation (internal, not Google PageSpeed)
  let score = 100;

  if (!has_title) {
    score -= 25;
    issues.push({ severity: 'HIGH', category: 'SEO', description: 'Page is missing a title tag' });
  } else if (title_length! < 10) {
    score -= 10;
    issues.push({ severity: 'MEDIUM', category: 'SEO', description: 'Page title is very short (under 10 characters)' });
  } else if (title_length! > 70) {
    score -= 5;
    issues.push({ severity: 'LOW', category: 'SEO', description: 'Page title is long (over 70 characters) and may be truncated in search results' });
  }

  if (!has_meta_description) {
    score -= 20;
    issues.push({ severity: 'MEDIUM', category: 'SEO', description: 'Page is missing a meta description' });
  } else if (meta_description_length! > 160) {
    score -= 5;
    issues.push({ severity: 'LOW', category: 'SEO', description: 'Meta description is long (over 160 characters)' });
  }

  if (!has_h1) {
    score -= 20;
    issues.push({ severity: 'HIGH', category: 'SEO', description: 'Page has no H1 heading' });
  } else if (h1_count > 1) {
    score -= 5;
    issues.push({ severity: 'LOW', category: 'SEO', description: `Page has ${h1_count} H1 headings — only one is recommended` });
  }

  if (!has_viewport_meta) {
    score -= 15;
    issues.push({ severity: 'HIGH', category: 'SEO', description: 'Page is missing a viewport meta tag (important for mobile)' });
  }

  if (!has_canonical) {
    score -= 5;
    issues.push({ severity: 'LOW', category: 'SEO', description: 'No canonical URL tag detected' });
  }

  return {
    has_title,
    title_length,
    has_meta_description,
    meta_description_length,
    has_h1,
    h1_count,
    has_canonical,
    has_viewport_meta,
    has_robots_meta,
    seo_score: Math.max(0, score),
    issues,
  };
}
