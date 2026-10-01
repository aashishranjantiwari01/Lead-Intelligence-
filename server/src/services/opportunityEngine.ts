import type { Opportunity, OpportunityType, OpportunityPriority } from '@lie/shared';

interface AuditContext {
  reachable: boolean;
  noWebsite?: boolean;
  has_contact_form: boolean;
  has_booking: boolean;
  has_whatsapp: boolean;
  has_clear_cta: boolean;
  mobile_friendly: boolean | null;
  performance_score: number | null;
  seo_score: number | null;
  has_instagram?: boolean;
  has_facebook?: boolean;
  https_enabled?: boolean;
}

interface OpportunityRule {
  id: string;
  type: OpportunityType;
  priority: OpportunityPriority;
  title: string;
  reason: string;
  condition: (ctx: AuditContext) => boolean;
}

const OPPORTUNITY_RULES: OpportunityRule[] = [
  {
    id: 'no_website',
    type: 'WEBSITE_REDESIGN',
    priority: 'HIGH',
    title: 'New website build opportunity',
    reason: 'No website detected for this business — high potential for new website development',
    condition: ctx => !!ctx.noWebsite,
  },
  {
    id: 'website_unreachable',
    type: 'WEBSITE_REDESIGN',
    priority: 'HIGH',
    title: 'Website rebuild/repair opportunity',
    reason: 'Existing website URL could not be reached — website may be down, broken, or expired',
    condition: ctx => !ctx.reachable && !ctx.noWebsite,
  },
  {
    id: 'poor_performance',
    type: 'PERFORMANCE',
    priority: 'MEDIUM',
    title: 'Website performance improvement opportunity',
    reason: 'Website has a low internal performance score — potential improvement through optimization or rebuild',
    condition: ctx => ctx.reachable && ctx.performance_score !== null && ctx.performance_score < 50,
  },
  {
    id: 'mobile_issues',
    type: 'MOBILE',
    priority: 'MEDIUM',
    title: 'Mobile layout improvement opportunity',
    reason: 'Mobile heuristic analysis detected potential layout issues — mobile-first redesign may improve user experience',
    condition: ctx => ctx.reachable && ctx.mobile_friendly === false,
  },
  {
    id: 'weak_seo',
    type: 'SEO',
    priority: 'MEDIUM',
    title: 'SEO improvement opportunity',
    reason: 'Website has low SEO score — missing critical SEO elements like title, meta description, or H1',
    condition: ctx => ctx.reachable && ctx.seo_score !== null && ctx.seo_score < 60,
  },
  {
    id: 'no_booking',
    type: 'BOOKING',
    priority: 'HIGH',
    title: 'Online booking integration opportunity',
    reason: 'No online booking flow detected — booking integration could capture leads 24/7',
    condition: ctx => ctx.reachable && !ctx.has_booking,
  },
  {
    id: 'no_whatsapp',
    type: 'WHATSAPP',
    priority: 'MEDIUM',
    title: 'WhatsApp enquiry automation opportunity',
    reason: 'No WhatsApp contact link detected — WhatsApp integration can improve enquiry conversion',
    condition: ctx => !ctx.has_whatsapp,
  },
  {
    id: 'no_cta',
    type: 'LEAD_CAPTURE',
    priority: 'HIGH',
    title: 'Lead capture improvement opportunity',
    reason: 'No clear call-to-action detected on the website — adding a strong CTA can significantly improve conversion',
    condition: ctx => ctx.reachable && !ctx.has_clear_cta,
  },
  {
    id: 'no_contact_form',
    type: 'LEAD_CAPTURE',
    priority: 'MEDIUM',
    title: 'Contact form implementation opportunity',
    reason: 'No contact form detected — a contact form makes it easy for visitors to reach out',
    condition: ctx => ctx.reachable && !ctx.has_contact_form,
  },
  {
    id: 'social_no_website',
    type: 'SOCIAL',
    priority: 'LOW',
    title: 'Social media to website conversion opportunity',
    reason: 'Business has social media presence but website needs improvement — social traffic may be going to a poor landing experience',
    condition: ctx => !!(ctx.has_instagram || ctx.has_facebook) && (!ctx.reachable || ctx.mobile_friendly === false),
  },
  {
    id: 'no_https',
    type: 'PERFORMANCE',
    priority: 'MEDIUM',
    title: 'HTTPS security upgrade opportunity',
    reason: 'Website is not served over HTTPS — this affects both security and SEO rankings',
    condition: ctx => ctx.reachable && ctx.https_enabled === false,
  },
];

export function generateOpportunities(ctx: AuditContext): Opportunity[] {
  const triggered: Opportunity[] = [];

  for (const rule of OPPORTUNITY_RULES) {
    try {
      if (rule.condition(ctx)) {
        // Avoid duplicate types (only add highest priority per type)
        const existing = triggered.find(o => o.type === rule.type);
        if (!existing) {
          triggered.push({
            type: rule.type,
            title: rule.title,
            reason: rule.reason,
            priority: rule.priority,
          });
        }
      }
    } catch {
      // Never let one rule crash the entire engine
    }
  }

  // Sort by priority: HIGH > MEDIUM > LOW
  const PRIORITY_ORDER: Record<OpportunityPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return triggered.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
