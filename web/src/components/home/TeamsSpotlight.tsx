import Link from "next/link";

import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import type { ApiResult } from "@/lib/api";
import type { Team } from "@/lib/schemas";

const GENDER_LABEL: Record<string, string> = {
  men: "Men's team",
  women: "Women's team",
  mixed: "Mixed team",
};

/**
 * Both teams, given the same size and the same treatment.
 *
 * Each block carries its own team's accent, so Marines Starlets appear in
 * their own kit colours rather than as a variation on the men's side.
 */
export function TeamsSpotlight({ result }: { result: ApiResult<Team[]> }) {
  return (
    <Section>
      <SectionHeading label="The club" title="Our teams" />
      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Team information" />
        ) : result.data.length === 0 ? (
          <EmptyState title="Teams coming soon">
            Squad information will appear here as the club publishes it.
          </EmptyState>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {result.data.map((team) => (
              <li key={team.id} data-team={toTeamAccentKey(team.accent_key)}>
                <Link
                  href={`/teams/${team.slug}`}
                  className="group flex h-full min-h-56 flex-col justify-end bg-accent p-6 text-chalk transition hover:brightness-110 sm:p-8"
                >
                  <p className="text-meta font-semibold uppercase tracking-widest text-chalk/80">
                    {GENDER_LABEL[team.gender] ?? "Team"}
                  </p>
                  <p className="mt-2 font-display text-headline font-black uppercase leading-none">
                    {team.name}
                  </p>
                  {team.summary ? (
                    <p className="mt-3 max-w-sm text-chalk/85">{team.summary}</p>
                  ) : null}
                  <p className="mt-5 font-semibold underline-offset-4 group-hover:underline">
                    Squad and fixtures
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
