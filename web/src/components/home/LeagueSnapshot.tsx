import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { ApiResult } from "@/lib/api";
import type { SeasonRef, Standing } from "@/lib/schemas";

type Snapshot = { rows: Standing[]; season: SeasonRef | null };

/**
 * Where the club stands.
 *
 * The table is maintained by hand because the county league publishes no data
 * feed, so an empty table is the normal state between seasons rather than a
 * fault. Goal difference carries an explicit sign; position is a number, not a
 * coloured badge.
 */
export function LeagueSnapshot({ result }: { result: ApiResult<Snapshot> }) {
  const ourRow = result.ok ? result.data.rows.find((row) => row.is_our_club) : undefined;
  const season = result.ok ? result.data.season : null;

  return (
    <Section tone="pitch">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-chalk/20 pb-4">
        <div>
          <p className="text-meta font-semibold text-accent-glow">
            {season ? season.competition.name : "League"}
          </p>
          <h2 className="mt-1 font-display text-headline font-extrabold uppercase">
            League position
          </h2>
        </div>
        <ButtonLink href="/league-table" variant="outline">
          Full table
        </ButtonLink>
      </div>

      <div className="mt-8">
        {!result.ok ? (
          <p className="text-chalk/75">The league table could not be loaded just now.</p>
        ) : ourRow ? (
          <dl className="grid grid-cols-2 gap-px border border-chalk/20 bg-chalk/20 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Position" value={ourRow.position} emphasis />
            <Stat label="Played" value={ourRow.played} />
            <Stat label="Won" value={ourRow.won} />
            <Stat label="Drawn" value={ourRow.drawn} />
            <Stat label="Lost" value={ourRow.lost} />
            <Stat
              label="Goal difference"
              value={
                ourRow.goal_difference > 0 ? `+${ourRow.goal_difference}` : ourRow.goal_difference
              }
            />
            <Stat label="Points" value={ourRow.points} emphasis />
          </dl>
        ) : (
          <div className="border border-chalk/20 bg-chalk/5 px-6 py-10 text-center sm:py-14">
            <p className="font-display text-xl font-extrabold uppercase tracking-wide">
              Season preparation
            </p>
            <p className="mx-auto mt-3 max-w-md text-chalk/75">
              The standings will appear here once the Kajiado County League season is under way.
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-pitch px-4 py-5">
      <dt className="text-meta text-chalk/60">{label}</dt>
      <dd
        className={
          emphasis
            ? "mt-1 font-display text-3xl font-black tabular-nums text-accent-glow"
            : "mt-1 font-display text-3xl font-black tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
