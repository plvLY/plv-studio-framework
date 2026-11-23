import type { APIRoute } from 'astro';
import { getProfile } from '../lib/data-source';

export const GET: APIRoute = async () => {
  const profile = await getProfile();
  const base = profile.seo.siteUrl.replace(/\/+$/, '');

  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
