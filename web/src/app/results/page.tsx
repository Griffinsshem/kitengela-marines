import type { Metadata } from "next";

import { MatchList } from "@/components/match/MatchList";
import { Pagination } from "@/components/match/Pagination";
import { TeamFilter } from "@/components/match/TeamFilter";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getResults, getTeams } from "@/lib/api";

export const metadata: Metadata = {
  title: "Results",
  description: "Match results for Kitengela Marines and Marines Starlets.",
};

type Search = { searchParams: Promise<{ team?: string; page?: string }> };

export default async function ResultsPage({ searchParams }: Search) {
  const { team, page } = await searchParams;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;

  const [teams, results] = await Promise.all([getTeams(), getResults({ team, page: pageNumber })]);

  return (
    <Section>
      <SectionHeading label="Match centre" title="Results" />
      {teams.ok ? (
        <div className="mt-6">
          <TeamFilter teams={teams.data} basePath="/results" current={team} />
        </div>
      ) : null}

      <div className="mt-8">
        {!results.ok ? (
          <UnavailableState what="Results" />
        ) : results.data.items.length === 0 ? (
          <EmptyState title="No matches played yet">
            Results will appear here once Kitengela Marines and Marines Starlets begin their
            season.
          </EmptyState>
        ) : (
          <>
            <MatchList fixtures={results.data.items} />
            <Pagination meta={results.data.meta} basePath="/results" team={team} />
          </>
        )}
      </div>
    </Section>
  );
}
