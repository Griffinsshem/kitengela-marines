import type { MetadataRoute } from "next";

import { getArticles, getGalleries, getTeams } from "@/lib/api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * What search engines should look at, and how often.
 *
 * The fixed pages are always listed. The rest — teams, stories, galleries —
 * come from the API, and if it is unreachable the sitemap is still valid with
 * the fixed pages alone. A failed request must not produce an empty or broken
 * sitemap, because search engines treat that as pages having been removed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/club`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/club/staff`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/teams`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/fixtures`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/results`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/league-table`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/news`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/media/photos`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/media/videos`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/partners`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const [teams, articles, galleries] = await Promise.all([
    getTeams(),
    getArticles({ perPage: 100 }),
    getGalleries({ perPage: 100 }),
  ]);

  const teamPages: MetadataRoute.Sitemap = teams.ok
    ? teams.data.map((team) => ({
        url: `${siteUrl}/teams/${team.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
    : [];

  const articlePages: MetadataRoute.Sitemap = articles.ok
    ? articles.data.items.map((article) => ({
        url: `${siteUrl}/news/${article.slug}`,
        // Search engines use this to decide whether to recrawl.
        lastModified: article.published_at ? new Date(article.published_at) : undefined,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }))
    : [];

  const galleryPages: MetadataRoute.Sitemap = galleries.ok
    ? galleries.data.items.map((gallery) => ({
        url: `${siteUrl}/media/photos/${gallery.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.4,
      }))
    : [];

  return [...fixed, ...teamPages, ...articlePages, ...galleryPages];
}
