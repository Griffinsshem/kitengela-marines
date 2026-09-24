import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Team } from "@/lib/schemas";

/**
 * Filters a list by team.
 *
 * Plain links rather than a select: each filter is a real URL a supporter can
 * bookmark or share, and the page works with JavaScript unavailable.
 */
export function TeamFilter({
  teams,
  basePath,
  current,
}: {
  teams: Team[];
  basePath: string;
  current?: string;
}) {
  if (teams.length < 2) return null;

  const options = [
    { slug: undefined, label: "All teams" },
    ...teams.map((team) => ({ slug: team.slug, label: team.short_name })),
  ];

  return (
    <nav aria-label="Filter by team" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.slug === current;
        return (
          <Link
            key={option.label}
            href={option.slug ? `${basePath}?team=${option.slug}` : basePath}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-control border px-4 font-semibold",
              active ? "border-accent-ink bg-accent-ink text-chalk" : "border-line hover:bg-turf",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
