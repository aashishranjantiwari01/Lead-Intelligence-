import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface AccessibilityAnalysisResult {
  accessibility_score: number;
  violations_count: number;
  violations_summary: string[];
  issues: AuditIssue[];
}

/**
 * Accessibility analyzer using @axe-core/playwright AxeBuilder API.
 * NOTE: This performs automated checks only. It does NOT constitute a
 * complete accessibility audit or certification.
 */
export async function analyzeAccessibility(page: Page): Promise<AccessibilityAnalysisResult> {
  const issues: AuditIssue[] = [];

  try {
    // Import the AxeBuilder class (new API in @axe-core/playwright v4+)
    const { AxeBuilder } = await import('@axe-core/playwright');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();

    const violations = results.violations;
    const violations_count = violations.length;

    const violations_summary = violations.slice(0, 10).map(
      v => `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description}`
    );

    // Score based on violations — each severity deducts points
    let score = 100;
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;
    const moderateCount = violations.filter(v => v.impact === 'moderate').length;

    score -= criticalCount * 20;
    score -= seriousCount * 10;
    score -= moderateCount * 5;
    score = Math.max(0, score);

    if (criticalCount > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Accessibility',
        description: `${criticalCount} critical accessibility violation(s) detected by automated check (axe-core)`,
      });
    }

    if (seriousCount > 0) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Accessibility',
        description: `${seriousCount} serious accessibility violation(s) detected by automated check (axe-core)`,
      });
    }

    if (moderateCount > 0) {
      issues.push({
        severity: 'LOW',
        category: 'Accessibility',
        description: `${moderateCount} moderate accessibility violation(s) detected by automated check (axe-core)`,
      });
    }

    return {
      accessibility_score: score,
      violations_count,
      violations_summary,
      issues,
    };
  } catch {
    // Accessibility check failed — return neutral result rather than crashing the audit
    return {
      accessibility_score: 50,
      violations_count: 0,
      violations_summary: ['Accessibility check could not be completed'],
      issues: [],
    };
  }
}
