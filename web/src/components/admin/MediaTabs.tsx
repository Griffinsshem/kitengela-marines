"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin/media", label: "Photographs" },
  { href: "/admin/media/galleries", label: "Galleries" },
  { href: "/admin/media/videos", label: "Videos" },
];

/** Moves between the three parts of the media section. */
export function MediaTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Media" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin/media" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-control border px-4 py-2 font-semibold",
              active
                ? "border-accent-ink bg-accent-ink text-chalk"
                : "border-line bg-chalk hover:bg-turf",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
