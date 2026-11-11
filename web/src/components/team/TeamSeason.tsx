import Link from "next/link";
import type { CSSProperties } from "react";

import { StatNumber } from "@/components/ui/StatNumber";
import { cn } from "@/lib/cn";
import type { Outcome, SeasonSummary } from "@/lib/season";

const PILL: Record<Outcome, string> = {
  W: "bg-highlight text-on-highlight",
  D: "bg-chalk/15 text-chalk",
  L: "border border-chalk/35 text-chalk/80",
};

/**
 * A team's season at a glance: the last five results, the share of matches
 * won, and the season's record.
 *
 * Built for the question a supporter actually asks, "how are we doing?", and
 * answered in one look before any figure is read. As it scrolls in, the form
 * pills pop in oldest to newest (the order the matches were played), the ring
 * fills to the win rate and the totals roll up to their values. Every figure
 * is final in the markup; the motion only adds sequence.
 *
 * Each pill is a link to its match and carries the result in words, so
 * nothing depends on telling the colours apart.
 */
export function TeamSeason({ summary }: { summary: SeasonSummary }) {
  const stats: { label: string; value: number }[] = [
    { label: "Played", value: summary.played },
    { label: "Won", value: summary.won },
    { label: "Drawn", value: summary.drawn },
    { label: "Lost", value: summary.lost },
    { label: "Scored", value: summary.goalsFor },
    { label: "Conceded", value: summary.goalsAgainst },
    { label: "Clean sheets", value: summary.cleanSheets },
  ];

  return (
    <section className="bg-pitch text-chalk">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="heading-rule heading-rule-dark border-b border-chalk/20 pb-4">
          <p className="heading-label text-meta font-semibold text-accent-glow">{summary.season}</p>
          <h2 className="mt-1 font-display text-headline font-extrabold uppercase">
            Season so far
          </h2>
        </div>

        <div className="form-guide mt-8 grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-16">
          <div className="flex flex-wrap items-center gap-8">
            <WinRing rate={summary.winRate} />

            <div>
              <p className="text-meta text-chalk/60">Form, oldest first</p>
              <ol className="mt-2 flex gap-2" aria-label="Last results, oldest first">
                {summary.form.map((entry, index) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/matches/${entry.slug}`}
                      title={entry.description}
                      className={cn(
                        "form-pill grid size-11 place-items-center rounded-control font-display text-xl font-black",
                        PILL[entry.outcome],
                      )}
                      style={{ "--i": index } as CSSProperties}
                    >
                      <span aria-hidden="true">{entry.outcome}</span>
                      <span className="sr-only">{entry.description}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px border border-chalk/20 bg-chalk/20 sm:grid-cols-4 xl:grid-cols-7">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-pitch px-4 py-5">
                <dt className="text-meta text-chalk/60">{stat.label}</dt>
                <dd className="mt-1 font-display text-3xl font-black tabular-nums">
                  <StatNumber value={stat.value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/**
 * The share of matches won, as a ring. Drawn with a 100-unit path so the
 * stroke offset is simply the percentage not won.
 */
function WinRing({ rate }: { rate: number }) {
  return (
    <figure className="relative size-32 shrink-0">
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-chalk/15" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="3"
          pathLength={100}
          strokeDasharray="100"
          className="win-ring-value stroke-highlight"
          style={{ "--ring-offset": 100 - rate } as CSSProperties}
        />
      </svg>
      <figcaption className="absolute inset-0 grid place-content-center text-center">
        <span className="font-display text-3xl font-black leading-none tabular-nums">{rate}%</span>
        <span className="text-meta text-chalk/60">won</span>
      </figcaption>
    </figure>
  );
}
