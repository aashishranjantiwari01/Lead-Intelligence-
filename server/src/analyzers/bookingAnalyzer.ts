import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface BookingAnalysisResult {
  has_booking: boolean;
  booking_provider: string | null;
  issues: AuditIssue[];
}

const BOOKING_PROVIDERS = [
  { name: 'Calendly', patterns: [/calendly\.com/i, /calendly/i] },
  { name: 'Acuity Scheduling', patterns: [/acuityscheduling\.com/i, /acuity/i] },
  { name: 'Fresha', patterns: [/fresha\.com/i, /fresha/i] },
  { name: 'Setmore', patterns: [/setmore\.com/i, /setmore/i] },
  { name: 'Booksy', patterns: [/booksy\.com/i, /booksy/i] },
  { name: 'SimplyBook', patterns: [/simplybook\.me/i, /simplybook/i] },
  { name: 'Mindbody', patterns: [/mindbodyonline\.com/i, /mindbody/i] },
  { name: 'Timely', patterns: [/gettimely\.com/i] },
  { name: 'Square Appointments', patterns: [/squareup\.com\/appointments/i] },
  { name: 'Vagaro', patterns: [/vagaro\.com/i] },
  { name: 'OpenTable', patterns: [/opentable\.com/i, /opentable/i] },
];

const BOOKING_KEYWORDS = [
  /\bbook\s+(now|appointment|online|a?\s*session)\b/i,
  /\bschedule\s+(appointment|meeting|call|online|now)\b/i,
  /\breserve\s+(a?\s*table|now|online)\b/i,
  /\bappointment\b/i,
  /\bonline\s+booking\b/i,
];

export async function analyzeBooking(page: Page): Promise<BookingAnalysisResult> {
  const html = await page.content().catch(() => '');
  const issues: AuditIssue[] = [];

  // Check known providers
  let booking_provider: string | null = null;
  for (const provider of BOOKING_PROVIDERS) {
    if (provider.patterns.some(p => p.test(html))) {
      booking_provider = provider.name;
      break;
    }
  }

  // Check generic booking keywords in links and buttons
  let hasKeywordBooking = false;
  if (!booking_provider) {
    try {
      hasKeywordBooking = await page.evaluate((keywords) => {
        const elements = document.querySelectorAll('a, button, [role="button"], h1, h2, h3');
        for (const el of Array.from(elements)) {
          const text = el.textContent?.trim() ?? '';
          if (keywords.some(kw => new RegExp(kw, 'i').test(text))) {
            return true;
          }
        }
        return false;
      }, BOOKING_KEYWORDS.map(k => k.source));
    } catch { /* ignore */ }
  }

  const has_booking = !!booking_provider || hasKeywordBooking;

  if (!has_booking) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Booking',
      description: 'No obvious online booking flow detected (heuristic check)',
    });
  }

  return {
    has_booking,
    booking_provider,
    issues,
  };
}
