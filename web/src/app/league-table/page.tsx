import type { Metadata } from "next";

import { LeagueTable } from "@/components/match/LeagueTable";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getStandings } from "@/lib/api";

export const metadata: Metadata = {
  title: "League table",
  description: "Kajiado County League standings.",
};

export default async function LeagueTablePage() {
  const result = await getStandings();
  const season = result.ok ? result.data.season : null;

  return (
    <Section>
      <SectionHeading
        label={season ? season.competition.name : "League"}
        title={season ? `${season.label} table` : "League table"}
      />
      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="The league table" />
        ) : result.data.rows.length === 0 ? (
          <EmptyState title="Season preparation">
            The Kajiado County League table will appear here once the season is under way. The
            club maintains it from the league&rsquo;s official results.
          </EmptyState>
        ) : (
          <LeagueTable rows={result.data.rows} />
        )}
      </div>
    </Section>
  );
}
