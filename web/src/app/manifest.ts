import type { MetadataRoute } from "next";

/**
 * Lets supporters keep the site on their home screen.
 *
 * Useful here in particular: a supporter checking Sunday's kick-off time
 * should not have to find the link again each week, and an installed site
 * opens without browser chrome, which makes a small screen feel larger.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kitengela Marines FC",
    short_name: "Marines",
    description:
      "Fixtures, results, squads and news from Kitengela Marines and Marines Starlets.",
    start_url: "/",
    display: "standalone",
    background_color: "#011e0f",
    theme_color: "#011e0f",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
