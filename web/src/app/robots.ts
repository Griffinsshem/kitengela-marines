import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * What search engines may index.
 *
 * Everything public, nothing under /admin. The admin is already marked
 * noindex in its own metadata; this keeps crawlers from spending requests on
 * pages that would only redirect them to a login screen.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
