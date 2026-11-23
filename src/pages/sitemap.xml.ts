import type { APIRoute } from 'astro';
import {
  getDocumentIndex,
  getProfile,
  getProgress,
  getWork,
  getWorkSlugs,
} from '../lib/data-source';
import { deriveRecentUpdate } from '../lib/derive';

interface SitemapEntry {
  path: string;
  lastmod?: string;
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const latest = (values: Array<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).sort((left, right) => right.localeCompare(left))[0];

export const GET: APIRoute = async () => {
  const [profile, slugs, progress] = await Promise.all([
    getProfile(),
    getWorkSlugs(),
    getProgress(),
  ]);

  const base = profile.seo.siteUrl.replace(/\/+$/, '');
  const entries: SitemapEntry[] = [];

  const workData = await Promise.all(
    slugs.map(async (slug) => {
      const [work, documents] = await Promise.all([getWork(slug), getDocumentIndex(slug)]);
      return {
        slug,
        work,
        documents,
        lastmod: deriveRecentUpdate(work, progress.projects[slug], documents),
      };
    }),
  );

  const allLastmod = latest([
    ...workData.map((item) => item.lastmod),
    ...workData.flatMap((item) => item.documents.map((document) => document.date)),
    progress.updatedAt.slice(0, 10),
  ]);

  entries.push({ path: '/', lastmod: allLastmod });
  entries.push({ path: '/projects/', lastmod: allLastmod });
  entries.push({ path: '/about/', lastmod: allLastmod });

  workData.forEach((item) => {
    entries.push({ path: `/projects/${item.slug}/`, lastmod: item.lastmod });

    item.documents.forEach((document) => {
      if (document.visibility === 'public') {
        entries.push({
          path: `/projects/${item.slug}/docs/${document.id}/`,
          lastmod: document.date,
        });
      }
    });
  });

  const urls = entries
    .map((entry) => {
      const loc = escapeXml(`${base}${entry.path}`);
      const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
