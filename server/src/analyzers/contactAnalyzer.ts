import type { Page } from 'playwright';
import type { AuditIssue } from '@lie/shared';

export interface ContactAnalysisResult {
  has_contact_form: boolean;
  has_mailto: boolean;
  has_tel_link: boolean;
  has_whatsapp: boolean;
  has_chat: boolean;
  has_clear_cta: boolean;
  issues: AuditIssue[];
}

// CTA keywords
const CTA_KEYWORDS = [
  'contact us', 'get in touch', 'request a quote', 'book now', 'book a call',
  'schedule', 'book appointment', 'get a quote', 'free consultation', 'call us',
  'get started', 'sign up', 'register', 'enquire', 'apply now', 'start now',
  'try free', 'order now', 'shop now', 'buy now',
];

// WhatsApp patterns
const WHATSAPP_PATTERNS = [
  /wa\.me\//i,
  /whatsapp\.com\/send/i,
  /api\.whatsapp\.com/i,
];

// Chat widget patterns
const CHAT_PATTERNS = [
  /intercom/i,
  /drift\.com/i,
  /tidio/i,
  /livechat/i,
  /freshchat/i,
  /crisp\.chat/i,
  /hubspot/i,
  /zendesk/i,
  /tawk\.to/i,
  /olark/i,
];

export async function analyzeContact(page: Page): Promise<ContactAnalysisResult> {
  const issues: AuditIssue[] = [];
  const html = await page.content().catch(() => '');

  // Contact form detection
  let has_contact_form = false;
  try {
    has_contact_form = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      for (const form of Array.from(forms)) {
        const text = form.textContent?.toLowerCase() ?? '';
        const inputs = form.querySelectorAll('input[type="email"], textarea, input[type="text"]');
        if (inputs.length >= 1 && (
          text.includes('contact') ||
          text.includes('name') ||
          text.includes('message') ||
          text.includes('email') ||
          form.querySelector('input[type="email"]')
        )) {
          return true;
        }
      }
      return false;
    });
  } catch { /* ignore */ }

  // mailto links
  const has_mailto = /href=["']mailto:/i.test(html);

  // tel: links
  const has_tel_link = /href=["']tel:/i.test(html);

  // WhatsApp
  const has_whatsapp = WHATSAPP_PATTERNS.some(p => p.test(html));

  // Chat widget
  const has_chat = CHAT_PATTERNS.some(p => p.test(html));

  // CTA detection
  let has_clear_cta = false;
  try {
    has_clear_cta = await page.evaluate((keywords) => {
      const buttons = document.querySelectorAll('button, a, [role="button"]');
      for (const el of Array.from(buttons)) {
        const text = el.textContent?.toLowerCase().trim() ?? '';
        if (keywords.some(kw => text.includes(kw))) {
          return true;
        }
      }
      return false;
    }, CTA_KEYWORDS);
  } catch { /* ignore */ }

  // Generate issues
  if (!has_contact_form && !has_mailto && !has_tel_link) {
    issues.push({
      severity: 'HIGH',
      category: 'Contact',
      description: 'No obvious contact path detected (no contact form, mailto, or phone link)',
    });
  }

  if (!has_clear_cta) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Contact',
      description: 'No clear call-to-action (CTA) detected on the page',
    });
  }

  if (!has_whatsapp) {
    issues.push({
      severity: 'LOW',
      category: 'Contact',
      description: 'No WhatsApp contact link detected',
    });
  }

  return {
    has_contact_form,
    has_mailto,
    has_tel_link,
    has_whatsapp,
    has_chat,
    has_clear_cta,
    issues,
  };
}
