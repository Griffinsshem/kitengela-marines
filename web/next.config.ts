import type { NextConfig } from "next";

/**
 * Security headers applied to every response. The CSP is strict by default and
 * widened only where a real feature needs it: YouTube/Vimeo for highlights,
 * the API origin for data fetches, Cloudinary for club photography.
 */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required.
  // React's development build needs eval() to reconstruct call stacks. It is
  // never used in production, so the production policy never allows it.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://res.cloudinary.com https://i.ytimg.com${
    process.env.NODE_ENV === "development" ? " http://localhost:5000" : ""
  }`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  // Match highlights are embedded, never self-hosted.
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      // Development only: images served by the local Flask API.
      ...(process.env.NODE_ENV === "development"
        ? ([{ protocol: "http", hostname: "localhost", port: "5000" }] as const)
        : []),
    ],
    formats: ["image/avif", "image/webp"],
    // Tuned to the breakpoints the layout actually uses, not Next.js defaults.
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 384],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
