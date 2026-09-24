import { MatchCard } from "@/components/match/MatchCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import type { ApiResult } from "@/lib/api";
import type { Fixture } from "@/lib/schemas";

export function LatestResult({ result }: { result: ApiResult<Fixture | null> }) {
  return (
    <Section tone="turf">
      <SectionHeading
        label="Match centre"
        title="Latest result"
        action={
          <ButtonLink href="/results" variant="outline">
            All results
          </ButtonLink>
        }
      />
      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="The latest result" />
        ) : result.data === null ? (
          <EmptyState title="No matches played yet">
            Results will appear here once Kitengela Marines and Marines Starlets begin their
            season.
          </EmptyState>
        ) : (
          <div className="max-w-3xl">
            <MatchCard fixture={result.data} />
          </div>
        )}
      </div>
    </Section>
  );
}
