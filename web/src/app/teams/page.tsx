import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getTeams } from "@/lib/api";

export const metadata: Metadata = {
  title: "Teams",
  description: "Kitengela Marines and Marines Starlets: squads, fixtures and results.",
};

export default async function TeamsPage() {
  const result = await getTeams();

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
                  <p className="font-display text-headline font-black uppercase leading-none">
                    {team.name}
                  </p>
                  <p className="mt-4 font-semibold underline-offset-4 group-hover:underline">
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
