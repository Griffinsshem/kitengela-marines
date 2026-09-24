import type { Metadata } from "next";

import { MatchList } from "@/components/match/MatchList";
import { Pagination } from "@/components/match/Pagination";
import { TeamFilter } from "@/components/match/TeamFilter";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getFixtures, getTeams } from "@/lib/api";

export const metadata: Metadata = {
  title: "Fixtures",
  description: "Upcoming matches for Kitengela Marines and Marines Starlets.",
};

type Search = { searchParams: Promise<{ team?: string; page?: string }> };

export default async function FixturesPage({ searchParams }: Search) {
  const { team, page } = await searchParams;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;

  const [teams, fixtures] = await Promise.all([
    getTeams(),
    getFixtures({ team, page: pageNumber }),
  ]);

  return (
    <Section>
      <SectionHeading label="Match centre" title="Fixtures" />
      {teams.ok ? (
        <div className="mt-6">
          <TeamFilter teams={teams.data} basePath="/fixtures" current={team} />
        </div>
      ) : null}

      <div className="mt-8">
        {!fixtures.ok ? (
          <UnavailableState what="Fixtures" />
        ) : fixtures.data.items.length === 0 ? (
          <EmptyState title="No fixtures announced">
            Kajiado County League fixtures will appear here once they are officially announced.
          </EmptyState>
        ) : (
          <>
            <MatchList fixtures={fixtures.data.items} />
            <Pagination meta={fixtures.data.meta} basePath="/fixtures" team={team} />
          </>
        )}
      </div>
    </Section>
  );
}
