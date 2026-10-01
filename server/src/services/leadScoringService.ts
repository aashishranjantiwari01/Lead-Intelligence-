import type { Lead } from '@lie/shared';
import type { ScoreReason, LeadScore } from '@lie/shared';

interface AuditContext {
  reachable: boolean;
  performance_score: number | null;
  seo_score: number | null;
  has_contact_form: boolean;
  has_booking: boolean;
  has_whatsapp: boolean;
  has_clear_cta: boolean;
  mobile_friendly: boolean | null;
}

/**
 * Lead Scoring Service.
 * Produces a transparent 0-100 score with explicit reasons.
 *
 * IMPORTANT: This is an internal sales-prioritization score.
 * It does NOT represent an objective quality rating of the business.
 * Higher scores = more potential opportunity for the sales rep.
 */
export function calculateLeadScore(lead: Lead, audit: AuditContext | null): LeadScore {
  const reasons: ScoreReason[] = [];
  let total = 0;

  function add(label: string, points: number) {
    if (points > 0) {
      reasons.push({ label, points });
      total += points;
    }
  }

  // ── WEBSITE OPPORTUNITY ─────────────────────────────────────────────────────

  const hasWebsite = !!lead.website;

  if (!hasWebsite) {
    add('No website detected', 30);
  } else if (audit && !audit.reachable) {
    add('Website is unreachable or broken', 25);
  } else if (audit && audit.reachable) {
    if (audit.performance_score !== null && audit.performance_score < 50) {
      add('Poor website performance (internal score)', 10);
    }
    if (audit.mobile_friendly === false) {
      add('Mobile layout issues detected (heuristic)', 10);
    }
  }

  // ── CONVERSION OPPORTUNITY ──────────────────────────────────────────────────

  if (audit && audit.reachable) {
    if (!audit.has_clear_cta) {
      add('No clear call-to-action detected', 8);
    }
    if (!audit.has_booking) {
      add('No online booking flow detected', 10);
    }
    if (!audit.has_contact_form) {
      add('No contact form detected', 8);
    }
  } else if (!audit || !audit.reachable) {
    // Can't check conversion signals without a working website
    // Apply partial score for missing website conversion path
    if (!hasWebsite) {
      add('No digital conversion path available', 8);
    }
  }

  // ── AUTOMATION OPPORTUNITY ──────────────────────────────────────────────────

  if (!audit?.has_whatsapp) {
    add('No WhatsApp enquiry channel detected', 5);
  }

  // Social presence without proper conversion flow
  const hasSocial = !!(lead.instagram || lead.facebook || lead.linkedin);
  if (hasSocial && audit && (!audit.has_contact_form || !audit.has_clear_cta)) {
    add('Social media presence but weak conversion flow', 5);
  }

  // ── CONTACTABILITY ──────────────────────────────────────────────────────────

  if (lead.email) {
    add('Email address available', 5);
  }
  if (lead.phone) {
    add('Phone number available', 5);
  }
  if (hasSocial) {
    add('Social media profile available', 3);
  }

  // Cap at 100
  total = Math.min(100, total);

  return { total, reasons };
}
