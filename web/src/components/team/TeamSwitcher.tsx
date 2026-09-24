import Link from "next/link";

import { toTeamAccentKey } from "@/config/teams";
import { cn } from "@/lib/cn";
import type { Team } from "@/lib/schemas";

/**
 * Moves between the club's teams.
 *
 * Each option carries its own accent, so the control shows what the site will
 * look like after the switch rather than which button happens to be selected.
 * The current team is marked with aria-current and an underline, not colour
 * alone.
 */
export function TeamSwitcher({ teams, currentSlug }: { teams: Team[]; currentSlug: string }) {
  if (teams.length < 2) return null;

  return (
    <nav aria-label="Teams" className="border-y border-line bg-chalk">
      <ul className="mx-auto flex max-w-7xl flex-wrap">
        {teams.map((team) => {
          const current = team.slug === currentSlug;
          return (
            <li key={team.id} data-team={toTeamAccentKey(team.accent_key)} className="flex-1">
              <Link
                href={`/teams/${team.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block px-5 py-4 text-center font-display text-lg font-extrabold uppercase tracking-wide sm:px-8",
                  current
                    ? "border-b-4 border-accent text-accent-ink"
                    : "border-b-4 border-transparent text-muted hover:text-pitch",
                )}
              >
                {team.short_name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
