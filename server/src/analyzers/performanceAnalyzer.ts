import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface PerformanceAnalysisResult {
  load_time_ms: number;
  page_size_bytes: number;
  performance_score: number; // Internal score, NOT Google PageSpeed
  issues: AuditIssue[];
}

export async function analyzePerformance(
  page: Page,
  navigationStart: number,
  domContentLoaded: number
): Promise<PerformanceAnalysisResult> {
  const issues: AuditIssue[] = [];

  const load_time_ms = domContentLoaded - navigationStart;

  // Estimate page size from content
  const pageContent = await page.content().catch(() => '');
  const page_size_bytes = Buffer.byteLength(pageContent, 'utf8');

  // Internal performance score (heuristic, not Google PageSpeed)
  let score = 100;

  // Score based on load time
  if (load_time_ms > 8000) {
    score -= 40;
    issues.push({
      severity: 'HIGH',
      category: 'Performance',
      description: `Page load took ${(load_time_ms / 1000).toFixed(1)}s — very slow (internal heuristic)`,
    });
  } else if (load_time_ms > 4000) {
    score -= 25;
    issues.push({
      severity: 'MEDIUM',
      category: 'Performance',
      description: `Page load took ${(load_time_ms / 1000).toFixed(1)}s — slow (internal heuristic)`,
    });
  } else if (load_time_ms > 2000) {
    score -= 10;
    issues.push({
      severity: 'LOW',
      category: 'Performance',
      description: `Page load took ${(load_time_ms / 1000).toFixed(1)}s — moderate (internal heuristic)`,
    });
  }

  // Score based on page size
  if (page_size_bytes > 500_000) {
    score -= 20;
    issues.push({
      severity: 'MEDIUM',
      category: 'Performance',
      description: `HTML page size is ${(page_size_bytes / 1024).toFixed(0)}KB — unusually large`,
    });
  } else if (page_size_bytes > 200_000) {
    score -= 10;
    issues.push({
      severity: 'LOW',
      category: 'Performance',
      description: `HTML page size is ${(page_size_bytes / 1024).toFixed(0)}KB — larger than average`,
    });
  }

  return {
    load_time_ms,
    page_size_bytes,
    performance_score: Math.max(0, score),
    issues,
  };
}
