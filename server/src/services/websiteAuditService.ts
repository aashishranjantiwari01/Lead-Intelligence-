import { chromium, type Browser, type BrowserContext } from 'playwright';
import { isPrivateHost } from '../utils/normalizeUrl';
import { installSsrfProtection } from '../utils/ssrfGuard';
import { config } from '../config';
import { logger } from '../utils/logger';
import { analyzeSeo } from '../analyzers/seoAnalyzer';
import { analyzePerformance } from '../analyzers/performanceAnalyzer';
import { analyzeMobile } from '../analyzers/mobileAnalyzer';
import { analyzeContact } from '../analyzers/contactAnalyzer';
import { analyzeBooking } from '../analyzers/bookingAnalyzer';
import { analyzeSocial } from '../analyzers/socialAnalyzer';
import { analyzeAnalytics } from '../analyzers/analyticsAnalyzer';
import { analyzeTechnology } from '../analyzers/technologyAnalyzer';
import { analyzeAccessibility } from '../analyzers/accessibilityAnalyzer';
import { generateOpportunities } from './opportunityEngine';
import { calculateLeadScore } from './leadScoringService';
import type { AuditIssue, Opportunity, Lead } from '@lie/shared';
import type { CreateAuditData } from '../db/AuditRepository';

export interface CheckResult {
  reachable: boolean;
  http_status: number | null;
  final_url: string | null;
  https_enabled: boolean;
  error_type: 'TIMEOUT' | 'DNS' | 'SSL' | 'BLOCKED' | 'HTTP_ERROR' | 'NAVIGATION' | null;
  error_message: string | null;
  navigationStart: number;
  domContentLoaded: number;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

async function checkWebsite(url: string): Promise<CheckResult> {
  // SSRF protection: validate host before making any request
  try {
    const parsed = new URL(url);
    if (isPrivateHost(parsed.hostname)) {
      return {
        reachable: false,
        http_status: null,
        final_url: null,
        https_enabled: false,
        error_type: 'BLOCKED',
        error_message: 'Blocked: URL points to a private/internal host',
        navigationStart: Date.now(),
        domContentLoaded: Date.now(),
      };
    }
  } catch {
    return {
      reachable: false,
      http_status: null,
      final_url: null,
      https_enabled: false,
      error_type: 'NAVIGATION',
      error_message: 'Invalid URL',
      navigationStart: Date.now(),
      domContentLoaded: Date.now(),
    };
  }

  const b = await getBrowser();
  const context: BrowserContext = await b.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (compatible; LeadIntelligenceEngine/1.0; +local)',
    ignoreHTTPSErrors: false,
  });

  const page = await context.newPage();
  const navigationStart = Date.now();
  let domContentLoaded = navigationStart;
  let finalUrl = url;
  let httpStatus: number | null = null;
  let https_enabled = url.startsWith('https://');

  try {
    // SSRF protection: attach the canonical guard BEFORE any navigation.
    // Every request (initial + redirect-followed sub-requests) is validated
    // via DNS resolution against all private/internal IP ranges.
    await installSsrfProtection(page);

    // Navigate with timeout
    const response = await page.goto(url, {
      timeout: config.auditTimeoutMs,
      waitUntil: 'domcontentloaded',
    });

    domContentLoaded = Date.now();
    finalUrl = page.url();
    https_enabled = finalUrl.startsWith('https://');
    httpStatus = response?.status() ?? null;

    // SSRF protection: re-validate final URL after redirects
    // A redirect from a public URL to a private/internal host must be blocked
    try {
      const finalParsed = new URL(finalUrl);
      if (isPrivateHost(finalParsed.hostname)) {
        await context.close().catch(() => {});
        return {
          reachable: false,
          http_status: null,
          final_url: null,
          https_enabled: false,
          error_type: 'BLOCKED',
          error_message: `Blocked: redirect destination is a private/internal host (${finalParsed.hostname})`,
          navigationStart,
          domContentLoaded: Date.now(),
        };
      }
    } catch {
      // If we can't parse the final URL, treat as safe and continue
    }

    await context.close();

    // Fix #3: only 2xx (and 304 Not Modified) are truly reachable.
    // 4xx/5xx mean the server responded with an error — not reachable.
    // Playwright returns the final status after following redirects, so
    // a 3xx here would only appear for unusual non-redirect 3xx responses.
    const status = httpStatus ?? 0;
    const reachable = !!response && status >= 200 && status < 400;
    const httpError = !!response && !reachable && status > 0;

    return {
      reachable,
      http_status: httpStatus,
      final_url: finalUrl,
      https_enabled,
      error_type: httpError ? 'HTTP_ERROR' : null,
      error_message: httpError ? `HTTP ${status}` : null,
      navigationStart,
      domContentLoaded,
    };
  } catch (err: unknown) {
    await context.close().catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    let error_type: CheckResult['error_type'] = 'NAVIGATION';

    if (msg.includes('Timeout') || msg.includes('timeout')) error_type = 'TIMEOUT';
    else if (msg.includes('net::ERR_NAME_NOT_RESOLVED') || msg.includes('DNS')) error_type = 'DNS';
    else if (msg.includes('SSL') || msg.includes('certificate') || msg.includes('ERR_CERT')) error_type = 'SSL';
    else if (msg.includes('403') || msg.includes('blocked')) error_type = 'BLOCKED';

    return {
      reachable: false,
      http_status: httpStatus,
      final_url: null,
      https_enabled: false,
      error_type,
      error_message: msg.slice(0, 500),
      navigationStart,
      domContentLoaded: Date.now(),
    };
  }
}

export interface FullAuditResult extends CreateAuditData {
  lead_score: number;
  website_score: number;
  automation_score: number;
  score_reasons: Array<{ label: string; points: number }>;
}

export async function runWebsiteAudit(lead: Lead): Promise<FullAuditResult> {
  const url = lead.website;

  if (!url) {
    // No website — generate opportunity without auditing
    const opportunities = generateOpportunities({
      reachable: false,
      noWebsite: true,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: false,
      performance_score: null,
      seo_score: null,
      has_instagram: !!lead.instagram,
      has_facebook: !!lead.facebook,
    });

    const scoring = calculateLeadScore(lead, null);

    return {
      lead_id: lead.id,
      url: '',
      reachable: false,
      https_enabled: false,
      issues: [{ severity: 'HIGH', category: 'Website', description: 'No website URL provided for this lead' }],
      opportunities,
      lead_score: scoring.total,
      website_score: 0,
      automation_score: 0,
      score_reasons: scoring.reasons,
    };
  }

  logger.info({ leadId: lead.id, url }, 'Starting website audit');

  // Phase 1: Check reachability
  const checkResult = await checkWebsite(url);

  if (!checkResult.reachable) {
    const issues: AuditIssue[] = [{
      severity: 'HIGH',
      category: 'Website',
      description: `Website is not reachable: ${checkResult.error_type ?? 'Unknown error'}${checkResult.error_message ? ` — ${checkResult.error_message}` : ''}`,
    }];

    const opportunities = generateOpportunities({
      reachable: false,
      noWebsite: false,
      has_contact_form: false,
      has_booking: false,
      has_whatsapp: false,
      has_clear_cta: false,
      mobile_friendly: false,
      performance_score: null,
      seo_score: null,
      has_instagram: !!lead.instagram,
      has_facebook: !!lead.facebook,
    });

    const scoring = calculateLeadScore(lead, { reachable: false, performance_score: null, seo_score: null, has_contact_form: false, has_booking: false, has_whatsapp: false, has_clear_cta: false, mobile_friendly: false });

    return {
      lead_id: lead.id,
      url,
      reachable: false,
      http_status: checkResult.http_status ?? undefined,
      final_url: checkResult.final_url ?? undefined,
      https_enabled: false,
      issues,
      opportunities,
      lead_score: scoring.total,
      website_score: 0,
      automation_score: 0,
      score_reasons: scoring.reasons,
    };
  }

  // Phase 2: Full audit on reachable page
  const finalUrl = checkResult.final_url ?? url;
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (compatible; LeadIntelligenceEngine/1.0; +local)',
  });
  const page = await context.newPage();

  const allIssues: AuditIssue[] = [];
  let seoResult, perfResult, mobileResult, contactResult, bookingResult, socialResult, analyticsResult, techResult, a11yResult;

  try {
    // Fix #1 (Part E): Protect the full audit context with the same SSRF guard
    // that is applied in checkWebsite(). Without this, the second Playwright
    // context could navigate to private destinations without interception.
    await installSsrfProtection(page);

    await page.goto(finalUrl, { timeout: config.auditTimeoutMs, waitUntil: 'domcontentloaded' });

    // Run all analyzers in parallel where safe
    [seoResult, perfResult, mobileResult, contactResult, bookingResult, socialResult, analyticsResult, techResult] = await Promise.all([
      analyzeSeo(page).catch(err => { logger.warn({ err }, 'SEO analysis failed'); return null; }),
      analyzePerformance(page, checkResult.navigationStart, checkResult.domContentLoaded).catch(() => null),
      analyzeMobile(page).catch(() => null),
      analyzeContact(page).catch(() => null),
      analyzeBooking(page).catch(() => null),
      analyzeSocial(page).catch(() => null),
      analyzeAnalytics(page).catch(() => null),
      analyzeTechnology(page).catch(() => null),
    ]);

    // Accessibility runs separately (needs axe injection)
    a11yResult = await analyzeAccessibility(page).catch(() => null);

    await context.close().catch(() => {});
  } catch (err) {
    await context.close().catch(() => {});
    logger.warn({ err, url }, 'Page analysis partially failed');
  }

  // Collect all issues
  if (seoResult?.issues) allIssues.push(...seoResult.issues);
  if (perfResult?.issues) allIssues.push(...perfResult.issues);
  if (mobileResult?.issues) allIssues.push(...mobileResult.issues);
  if (contactResult?.issues) allIssues.push(...contactResult.issues);
  if (bookingResult?.issues) allIssues.push(...bookingResult.issues);
  if (a11yResult?.issues) allIssues.push(...a11yResult.issues);

  // HTTPS issue
  if (!checkResult.https_enabled) {
    allIssues.push({ severity: 'MEDIUM', category: 'Security', description: 'Website is not served over HTTPS' });
  }

  // Generate opportunities
  const auditParams = {
    reachable: true,
    noWebsite: false,
    has_contact_form: contactResult?.has_contact_form ?? false,
    has_booking: bookingResult?.has_booking ?? false,
    has_whatsapp: contactResult?.has_whatsapp ?? false,
    has_clear_cta: contactResult?.has_clear_cta ?? false,
    mobile_friendly: mobileResult?.mobile_friendly ?? null,
    performance_score: perfResult?.performance_score ?? null,
    seo_score: seoResult?.seo_score ?? null,
    has_instagram: socialResult?.has_instagram ?? !!lead.instagram,
    has_facebook: socialResult?.has_facebook ?? !!lead.facebook,
    https_enabled: checkResult.https_enabled,
  };

  const opportunities: Opportunity[] = generateOpportunities(auditParams);

  // Lead scoring
  const scoringParams = {
    reachable: true,
    performance_score: perfResult?.performance_score ?? null,
    seo_score: seoResult?.seo_score ?? null,
    has_contact_form: contactResult?.has_contact_form ?? false,
    has_booking: bookingResult?.has_booking ?? false,
    has_whatsapp: contactResult?.has_whatsapp ?? false,
    has_clear_cta: contactResult?.has_clear_cta ?? false,
    mobile_friendly: mobileResult?.mobile_friendly ?? null,
  };

  const scoring = calculateLeadScore(lead, scoringParams);

  // Calculate website_score
  const scores = [
    seoResult?.seo_score,
    perfResult?.performance_score,
    a11yResult?.accessibility_score,
  ].filter((s): s is number => s !== null && s !== undefined);
  const website_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

  // Automation score (based on automation opportunities)
  const automationOpps = opportunities.filter(o =>
    ['WHATSAPP', 'BOOKING', 'AUTOMATION', 'LEAD_CAPTURE'].includes(o.type)
  );
  const automation_score = Math.min(100, automationOpps.length * 25);

  const raw_metadata = {
    seo: seoResult,
    performance: perfResult,
    mobile: mobileResult,
    social: socialResult,
    analytics: analyticsResult,
    technology: techResult,
    accessibility: a11yResult ? { score: a11yResult.accessibility_score, violations: a11yResult.violations_count } : null,
    booking: bookingResult,
    check: { http_status: checkResult.http_status, final_url: checkResult.final_url },
  };

  return {
    lead_id: lead.id,
    url,
    reachable: true,
    http_status: checkResult.http_status ?? undefined,
    final_url: finalUrl,
    https_enabled: checkResult.https_enabled,
    mobile_friendly: mobileResult?.mobile_friendly ?? undefined,
    load_time_ms: perfResult?.load_time_ms ?? undefined,
    page_size_bytes: perfResult?.page_size_bytes ?? undefined,
    performance_score: perfResult?.performance_score ?? undefined,
    seo_score: seoResult?.seo_score ?? undefined,
    accessibility_score: a11yResult?.accessibility_score ?? undefined,
    best_practices_score: undefined,
    has_title: seoResult?.has_title ?? false,
    has_meta_description: seoResult?.has_meta_description ?? false,
    has_h1: seoResult?.has_h1 ?? false,
    has_contact_form: contactResult?.has_contact_form ?? false,
    has_booking: bookingResult?.has_booking ?? false,
    has_whatsapp: contactResult?.has_whatsapp ?? false,
    has_chat: contactResult?.has_chat ?? false,
    has_clear_cta: contactResult?.has_clear_cta ?? false,
    has_instagram: socialResult?.has_instagram ?? false,
    has_facebook: socialResult?.has_facebook ?? false,
    has_linkedin: socialResult?.has_linkedin ?? false,
    analytics_detected: analyticsResult?.analytics_detected ?? false,
    meta_pixel_detected: analyticsResult?.meta_pixel_detected ?? false,
    cms_detected: techResult?.cms_detected ?? undefined,
    issues: allIssues,
    opportunities,
    raw_metadata,
    lead_score: scoring.total,
    website_score,
    automation_score,
    score_reasons: scoring.reasons,
  };
}
