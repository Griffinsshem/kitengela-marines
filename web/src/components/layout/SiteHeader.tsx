import Link from "next/link";

import { SUPPORT_LINK, buildNavigation } from "@/config/navigation";
import { getTeams } from "@/lib/api";

import { ClubMark } from "./ClubMark";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

/**
 * Site header. A server component: it fetches the team list and hands plain
 * data to the two small client components that need interactivity.
 *
 * If the API is unreachable the header still renders — the Teams menu
 * collapses to a link — because a header that throws takes every page with it.
 *
 * The full desktop bar starts at 1280px. Seven items, the wordmark and the
 * Support button do not fit legibly at 1024px, and squeezing them would be
 * exactly the cramped desktop-menu-on-a-small-screen the brief rules out.
 */
export async function SiteHeader() {
  const result = await getTeams();
  const teams = result.ok ? result.data : [];
  const items = buildNavigation(teams);

  return (
    <header className="sticky top-0 z-40 border-b-4 border-accent bg-pitch text-chalk">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 xl:h-18">
        <ClubMark className="text-2xl xl:text-3xl" />
        <DesktopNav items={items} />
        <div className="flex items-center gap-2">
          <Link
            href={SUPPORT_LINK.href}
            className="hidden rounded-control bg-highlight px-4 py-2 font-semibold text-on-highlight xl:inline-block"
          >
            {SUPPORT_LINK.label}
          </Link>
          <MobileNav items={items} teams={teams} />
        </div>
      </div>
    </header>
  );
}
