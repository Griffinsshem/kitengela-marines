import Link from "next/link";

import { formatDayMonth, formatKickoff, formatMatchDate } from "@/lib/datetime";
import type { Fixture } from "@/lib/schemas";
import { cn } from "@/lib/cn";

const RESULT_WORD: Record<string, string> = { W: "Won", D: "Drew", L: "Lost" };

/**
 * A match, whether it has been played or not.
 *
 * Sides are shown in home-then-away order, which is how a scoreline is read,
 * and the API already reports the score both ways so no arithmetic happens
 * here. The outcome is spelled out in words as well as the letter, so nothing
 * depends on seeing a colour.
 */
export function MatchCard({
  fixture,
  tone = "light",
}: {
  fixture: Fixture;
  tone?: "light" | "dark";
}) {
  const isAway = fixture.venue === "away";
  const home = isAway ? fixture.opponent.name : fixture.team.name;
  const away = isAway ? fixture.team.name : fixture.opponent.name;

  const dark = tone === "dark";
  const date = formatMatchDate(fixture.kickoff_at) ?? formatDayMonth(fixture.scheduled_on);
  const kickoff = formatKickoff(fixture.kickoff_at);

  return (
    <article
      className={cn(
        "border",
        dark ? "border-chalk/20 bg-chalk/5 text-chalk" : "border-line bg-chalk text-pitch",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b px-5 py-3 text-meta font-semibold",
          dark ? "border-chalk/20" : "border-line",
        )}
      >
        <span>{fixture.competition.short_name}</span>
        <span className={dark ? "text-accent-glow" : "text-accent-ink"}>
          {isAway ? "Away" : fixture.venue === "home" ? "Home" : "Neutral"}
        </span>
      </header>

      <div className="px-5 py-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="font-display text-2xl font-extrabold uppercase leading-none sm:text-3xl">
            {home}
          </p>
          {fixture.is_completed ? (
            <p className="font-display text-score font-black tabular-nums leading-none">
              {fixture.home_score}
              <span className={dark ? "px-2 text-accent-glow" : "px-2 text-accent-ink"}>–</span>
              {fixture.away_score}
            </p>
          ) : (
            <p className="text-meta font-semibold uppercase tracking-widest">v</p>
          )}
          <p className="text-right font-display text-2xl font-extrabold uppercase leading-none sm:text-3xl">
            {away}
          </p>
        </div>

        <dl
          className={cn(
            "mt-6 grid gap-3 border-t pt-4 text-meta sm:grid-cols-3",
            dark ? "border-chalk/20" : "border-line",
          )}
        >
          {date ? (
            <div>
              <dt className={dark ? "text-chalk/60" : "text-muted"}>Date</dt>
              <dd className="font-semibold">{date}</dd>
            </div>
          ) : null}
          {kickoff ? (
            <div>
              <dt className={dark ? "text-chalk/60" : "text-muted"}>Kick-off</dt>
              <dd className="font-semibold tabular-nums">{kickoff}</dd>
            </div>
          ) : null}
          {fixture.venue_name ? (
            <div>
              <dt className={dark ? "text-chalk/60" : "text-muted"}>Venue</dt>
              <dd className="font-semibold">{fixture.venue_name}</dd>
            </div>
          ) : null}
        </dl>

        {fixture.is_completed && fixture.result ? (
          <p className="mt-4 text-meta font-semibold">
            {RESULT_WORD[fixture.result] ?? fixture.result}{" "}
            <Link
              href={`/matches/${fixture.slug}`}
              className={cn(
                "underline underline-offset-4",
                dark ? "decoration-accent-glow" : "decoration-accent-ink",
              )}
            >
              Match details
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}
