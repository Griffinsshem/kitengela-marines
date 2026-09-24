import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

const SKIP_LINK_CLASSES = [
  "sr-only",
  "focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
  "focus:rounded-control focus:bg-highlight focus:px-4 focus:py-2",
  "focus:font-semibold focus:text-on-highlight",
].join(" ");

/** The public website: club navigation, footer and the page landmarks. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* First focusable element: keyboard users skip the navigation. */}
      <a href="#content" className={SKIP_LINK_CLASSES}>
        Skip to content
      </a>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
