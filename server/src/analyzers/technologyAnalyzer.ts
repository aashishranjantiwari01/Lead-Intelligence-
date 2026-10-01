import type { Page } from 'playwright';

export interface TechnologyAnalysisResult {
  cms_detected: string | null;
  technologies: string[];
}

// Technology fingerprints from publicly served HTML
const CMS_FINGERPRINTS = [
  { name: 'WordPress', patterns: [/wp-content\//i, /wp-includes\//i, /\/wp-json\//i] },
  { name: 'Shopify', patterns: [/cdn\.shopify\.com/i, /shopify\.com\/s\/files/i, /Shopify\.theme/i] },
  { name: 'Webflow', patterns: [/webflow\.com/i, /\.webflow\.io/i, /data-wf-site/i] },
  { name: 'Wix', patterns: [/static\.wixstatic\.com/i, /wix\.com/i, /wixsite\.com/i, /X-Wix-/i] },
  { name: 'Squarespace', patterns: [/squarespace\.com/i, /static1\.squarespace\.com/i] },
  { name: 'Framer', patterns: [/framer\.com/i, /framerusercontent\.com/i] },
  { name: 'Ghost', patterns: [/ghost\.org/i, /ghost-theme/i] },
  { name: 'Drupal', patterns: [/drupal\.js/i, /sites\/default\/files/i, /X-Generator.*Drupal/i] },
  { name: 'Joomla', patterns: [/\/components\/com_/i, /Joomla!/i] },
  { name: 'HubSpot CMS', patterns: [/js\.hubspot\.net/i, /hs-scripts\.com/i] },
];

const TECH_FINGERPRINTS = [
  { name: 'React', patterns: [/__REACT_FIBER/i, /react\.development\.js/i, /react\.production\.min\.js/i, /data-reactroot/i, /_next\//i] },
  { name: 'Next.js', patterns: [/_next\/static/i, /__NEXT_DATA__/i] },
  { name: 'Vue.js', patterns: [/vue\.runtime\.global/i, /vue\.min\.js/i, /data-v-[a-z0-9]+/i] },
  { name: 'Angular', patterns: [/ng-version/i, /angular\.js/i, /angular\.min\.js/i] },
  { name: 'jQuery', patterns: [/jquery\.min\.js/i, /jquery-\d/i] },
  { name: 'Bootstrap', patterns: [/bootstrap\.min\.css/i, /bootstrap\.min\.js/i] },
  { name: 'Tailwind CSS', patterns: [/tailwindcss/i, /tailwind\.min\.css/i] },
  { name: 'Stripe', patterns: [/js\.stripe\.com/i] },
  { name: 'Cloudflare', patterns: [/cloudflare/i, /cf-ray/i] },
];

export async function analyzeTechnology(page: Page): Promise<TechnologyAnalysisResult> {
  const html = await page.content().catch(() => '');
  const technologies: string[] = [];
  let cms_detected: string | null = null;

  // Detect CMS
  for (const cms of CMS_FINGERPRINTS) {
    if (cms.patterns.some(p => p.test(html))) {
      cms_detected = cms.name;
      technologies.push(cms.name);
      break;
    }
  }

  // Detect other technologies
  for (const tech of TECH_FINGERPRINTS) {
    if (tech.patterns.some(p => p.test(html)) && !technologies.includes(tech.name)) {
      technologies.push(tech.name);
    }
  }

  return { cms_detected, technologies };
}
