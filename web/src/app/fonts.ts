import { Barlow, Big_Shoulders } from "next/font/google";

/**
 * Both families come from signage: Big Shoulders from Chicago street signs,
 * Barlow from California highway signs. That lineage suits a site made largely
 * of fixture boards, tables and scorelines.
 *
 * next/font downloads the files at build time and serves them from our own
 * origin, so nothing is requested from Google at runtime and the CSP's
 * font-src 'self' needs no exception.
 */
export const display = Big_Shoulders({
  subsets: ["latin"],
  // Optical size lets the browser choose the display cut at poster sizes and
  // the text cut at small sizes, from one file. Google merged the former
  // Big Shoulders Display and Text families into this single variable family.
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
  // Next has no metrics for the merged family, so it cannot build an adjusted
  // fallback. A condensed system face keeps the swap small instead.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});

export const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});
