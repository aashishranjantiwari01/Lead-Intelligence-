import type { Page } from 'playwright';

export interface SocialAnalysisResult {
  has_instagram: boolean;
  instagram_url: string | null;
  has_facebook: boolean;
  facebook_url: string | null;
  has_linkedin: boolean;
  linkedin_url: string | null;
  has_youtube: boolean;
  youtube_url: string | null;
  has_tiktok: boolean;
  tiktok_url: string | null;
}

export async function analyzeSocial(page: Page): Promise<SocialAnalysisResult> {
  const html = await page.content().catch(() => '');

  function extractUrl(pattern: RegExp): string | null {
    const match = html.match(pattern);
    return match ? match[1] : null;
  }

  // Instagram
  const instagramMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/);
  const instagram_url = instagramMatch ? instagramMatch[0] : null;

  // Facebook
  const facebookMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[^\s"'<>]+/);
  const facebook_url = facebookMatch ? facebookMatch[0].replace(/['"<>].*$/, '') : null;

  // LinkedIn
  const linkedinMatch = html.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+/);
  const linkedin_url = linkedinMatch ? linkedinMatch[0].replace(/['"<>].*$/, '') : null;

  // YouTube
  const youtubeMatch = html.match(/https?:\/\/(www\.)?youtube\.com\/(channel|c|user|@)[^\s"'<>]+/);
  const youtube_url = youtubeMatch ? youtubeMatch[0].replace(/['"<>].*$/, '') : null;

  // TikTok
  const tiktokMatch = html.match(/https?:\/\/(www\.)?tiktok\.com\/@[^\s"'<>]+/);
  const tiktok_url = tiktokMatch ? tiktokMatch[0].replace(/['"<>].*$/, '') : null;

  return {
    has_instagram: !!instagram_url,
    instagram_url,
    has_facebook: !!facebook_url,
    facebook_url,
    has_linkedin: !!linkedin_url,
    linkedin_url,
    has_youtube: !!youtube_url,
    youtube_url,
    has_tiktok: !!tiktok_url,
    tiktok_url,
  };
}
