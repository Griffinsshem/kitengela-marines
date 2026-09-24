import { MatchCard } from "@/components/match/MatchCard";
import { toTeamAccentKey } from "@/config/teams";
import { groupByMonth } from "@/lib/matches";
import type { Fixture } from "@/lib/schemas";

/** A fixture list, broken by month the way a fixture board is. */
export function MatchList({ fixtures }: { fixtures: Fixture[] }) {
  const groups = groupByMonth(fixtures);

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`month-${group.key}`}>
          <h2
            id={`month-${group.key}`}
            className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase tracking-wide"
          >
            {group.label}
          </h2>
          <ul className="mt-6 space-y-4">
            {group.fixtures.map((fixture) => (
              <li key={fixture.slug} data-team={toTeamAccentKey(fixture.team.accent_key)}>
                <MatchCard fixture={fixture} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
