import type { Page } from 'playwright';

export interface AnalyticsAnalysisResult {
  analytics_detected: boolean;
  google_analytics: boolean;
  google_tag_manager: boolean;
  meta_pixel_detected: boolean;
  other_analytics: string[];
}

export async function analyzeAnalytics(page: Page): Promise<AnalyticsAnalysisResult> {
  const html = await page.content().catch(() => '');

  // Google Analytics (UA, GA4)
  const google_analytics =
    /google-analytics\.com\/analytics\.js/i.test(html) ||
    /gtag\s*\(/i.test(html) ||
    /GA_MEASUREMENT_ID/i.test(html) ||
    /UA-\d{4,}-\d/i.test(html) ||
    /G-[A-Z0-9]{8,}/i.test(html);

  // Google Tag Manager
  const google_tag_manager =
    /googletagmanager\.com\/gtm\.js/i.test(html) ||
    /GTM-[A-Z0-9]{4,}/i.test(html);

  // Meta (Facebook) Pixel
  const meta_pixel_detected =
    /connect\.facebook\.net.*fbevents\.js/i.test(html) ||
    /fbq\s*\(/i.test(html) ||
    /facebook\.net\/en_US\/fbevents\.js/i.test(html);

  const other_analytics: string[] = [];
  if (/hotjar\.com/i.test(html)) other_analytics.push('Hotjar');
  if (/mixpanel\.com/i.test(html)) other_analytics.push('Mixpanel');
  if (/segment\.com\/analytics/i.test(html)) other_analytics.push('Segment');
  if (/heap\.io/i.test(html) || /heapanalytics\.com/i.test(html)) other_analytics.push('Heap');
  if (/matomo\.org/i.test(html) || /piwik\.pro/i.test(html)) other_analytics.push('Matomo');
  if (/clarity\.ms/i.test(html)) other_analytics.push('Microsoft Clarity');
  if (/mc\.yandex\.ru/i.test(html)) other_analytics.push('Yandex.Metrica');

  const analytics_detected = google_analytics || google_tag_manager || meta_pixel_detected || other_analytics.length > 0;

  return {
    analytics_detected,
    google_analytics,
    google_tag_manager,
    meta_pixel_detected,
    other_analytics,
  };
}
