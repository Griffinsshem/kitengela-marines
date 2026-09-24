import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UnavailableState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getMatch } from "@/lib/api";
import { formatDayMonth, formatKickoff, formatMatchDate } from "@/lib/datetime";
import type { LineupEntry, MatchEvent, PlayerRef } from "@/lib/schemas";

type Params = { params: Promise<{ slug: string }> };

const EVENT_LABEL: Record<string, string> = {
  goal: "Goal",
  own_goal: "Own goal",
  penalty_scored: "Penalty scored",
  penalty_missed: "Penalty missed",
  yellow_card: "Yellow card",
  second_yellow: "Second yellow",
  red_card: "Red card",
  substitution: "Substitution",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await getMatch(slug);
  if (!result.ok) return { title: "Match" };

  const match = result.data;
  const title = match.is_completed
    ? `${match.team.name} ${match.our_score}-${match.their_score} ${match.opponent.name}`
    : `${match.team.name} v ${match.opponent.name}`;

  return { title, description: `${match.competition.name}, ${match.season}.` };
}

export default async function MatchPage({ params }: Params) {
  const { slug } = await params;
  const result = await getMatch(slug);

  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return (
      <Section>
        <UnavailableState what="This match" />
      </Section>
    );
  }

  const match = result.data;
  const isAway = match.venue === "away";
  const home = isAway ? match.opponent.name : match.team.name;
  const away = isAway ? match.team.name : match.opponent.name;
  const date = formatMatchDate(match.kickoff_at) ?? formatDayMonth(match.scheduled_on);
  const kickoff = formatKickoff(match.kickoff_at);

  return (
    <div data-team={toTeamAccentKey(match.team.accent_key)}>
      <section className="bg-pitch text-chalk">
        <div className="mx-auto max-w-5xl px-5 py-12 text-center sm:px-8 sm:py-16">
          <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
            {match.competition.name}
          </p>

          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <p className="font-display text-headline font-black uppercase leading-none">{home}</p>
            {match.is_completed ? (
              <p className="font-display text-score font-black tabular-nums leading-none">
                {match.home_score}
                <span className="px-3 text-accent-glow">–</span>
                {match.away_score}
              </p>
            ) : (
              <p className="text-meta font-semibold uppercase tracking-widest">v</p>
            )}
            <p className="font-display text-headline font-black uppercase leading-none">{away}</p>
          </div>

          <dl className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-4 text-meta">
            {date ? <Detail label="Date" value={date} /> : null}
            {kickoff ? <Detail label="Kick-off" value={kickoff} /> : null}
            {match.venue_name ? <Detail label="Venue" value={match.venue_name} /> : null}
            <Detail label="Season" value={match.season} />
          </dl>

          {match.player_of_the_match ? (
            <p className="mt-8 text-meta">
              <span className="text-chalk/60">Player of the match</span>{" "}
              <PlayerLink player={match.player_of_the_match} teamSlug={match.team.slug} glow />
            </p>
          ) : null}
        </div>
      </section>

      {match.events.length > 0 ? (
        <Section tone="turf">
          <h2 className="border-b border-line pb-2 font-display text-headline font-extrabold uppercase">
            Match events
          </h2>
          <ol className="mt-6 space-y-3">
            {match.events.map((event, index) => (
              <li key={`${event.type}-${event.minute}-${index}`}>
                <EventRow event={event} teamSlug={match.team.slug} />
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {match.lineup.starters.length > 0 ? (
        <Section>
          <h2 className="border-b border-line pb-2 font-display text-headline font-extrabold uppercase">
            {match.team.short_name} line-up
          </h2>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <LineupList
              label="Starting eleven"
              entries={match.lineup.starters}
              teamSlug={match.team.slug}
            />
            {match.lineup.substitutes.length > 0 ? (
              <LineupList
                label="Substitutes used"
                entries={match.lineup.substitutes}
                teamSlug={match.team.slug}
              />
            ) : null}
            {match.lineup.unused_substitutes.length > 0 ? (
              <LineupList
                label="Unused substitutes"
                entries={match.lineup.unused_substitutes}
                teamSlug={match.team.slug}
              />
            ) : null}
          </div>
        </Section>
      ) : null}

      {match.report ? (
        <Section tone={match.lineup.starters.length > 0 ? "turf" : "chalk"}>
          <h2 className="border-b border-line pb-2 font-display text-headline font-extrabold uppercase">
            Match report
          </h2>
          <p className="mt-6 max-w-3xl whitespace-pre-line text-lg leading-relaxed">
            {match.report}
          </p>
        </Section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-chalk/60">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function PlayerLink({
  player,
  teamSlug,
  glow = false,
}: {
  player: PlayerRef;
  teamSlug: string;
  glow?: boolean;
}) {
  return (
    <Link
      href={`/teams/${teamSlug}/players/${player.slug}`}
      className={
        glow
          ? "font-semibold text-accent-glow underline-offset-4 hover:underline"
          : "font-semibold underline-offset-4 hover:underline"
      }
    >
      {player.display_name}
    </Link>
  );
}

/**
 * One event.
 *
 * The minute is shown as a number and the event named in words, so a goal and
 * a red card are told apart by reading rather than by colour. Opposition
 * events are labelled, since they carry no player of ours.
 */
function EventRow({ event, teamSlug }: { event: MatchEvent; teamSlug: string }) {
  const minute = event.minute
    ? `${event.minute}${event.added_time ? `+${event.added_time}` : ""}'`
    : "";

  return (
    <div className="flex items-baseline gap-4 border-b border-line pb-3">
      <span className="w-14 shrink-0 font-display text-lg font-black tabular-nums text-accent-ink">
        {minute}
      </span>
      <span className="font-semibold">{EVENT_LABEL[event.type] ?? event.type}</span>
      <span className="text-muted">
        {event.is_opposition ? (
          "Opposition"
        ) : event.player ? (
          <PlayerLink player={event.player} teamSlug={teamSlug} />
        ) : null}
        {event.related_player ? (
          <>
            {" for "}
            <PlayerLink player={event.related_player} teamSlug={teamSlug} />
          </>
        ) : null}
      </span>
    </div>
  );
}

function LineupList({
  label,
  entries,
  teamSlug,
}: {
  label: string;
  entries: LineupEntry[];
  teamSlug: string;
}) {
  return (
    <section>
      <h3 className="font-display text-xl font-extrabold uppercase tracking-wide">{label}</h3>
      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.player.slug}
            className="flex items-baseline gap-3 border-b border-line pb-2"
          >
            <span className="w-8 shrink-0 font-display text-lg font-black tabular-nums text-muted">
              {entry.player.squad_number ?? ""}
            </span>
            <PlayerLink player={entry.player} teamSlug={teamSlug} />
            {entry.goals > 0 ? (
              <span className="text-meta text-muted">
                {entry.goals} {entry.goals === 1 ? "goal" : "goals"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
