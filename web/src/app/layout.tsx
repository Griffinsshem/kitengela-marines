import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

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
  // Colours the mobile browser chrome to match the pitch surface.
  themeColor: "#011e0f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body data-team="club">{children}</body>
    </html>
  );
}
