import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

import { display, sans } from "./fonts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kitengela Marines FC | Official Website",
    template: "%s | Kitengela Marines",
  },
  description:
    "The official website of Kitengela Marines and Marines Starlets, a football club from Kitengela, Kajiado County.",
};

export const viewport: Viewport = {
  themeColor: "#011e0f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body data-team="club" className="flex min-h-dvh flex-col">
        {/* First focusable element: keyboard users skip the navigation. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-highlight focus:px-4 focus:py-2 focus:font-semibold focus:text-on-highlight"
        >
          Skip to content
        </a>
        <SiteHeader />
        {/* The layout owns <main>, so pages must not render their own. */}
        <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
