"use client";

import { ArrowLeft, ArrowRight, MapPin } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { Countdown } from "@/components/match/Countdown";
import { toTeamAccentKey } from "@/config/teams";
import { cn } from "@/lib/cn";
import { formatKickoff, isMatchday, ticketDate } from "@/lib/datetime";
import type { Fixture } from "@/lib/schemas";

/**
 * The next few fixtures as a stack of matchday tickets.
 *
 * The top ticket is the next match; the ones after it peek out beneath. On a
 * phone the top ticket is swiped aside to bring the next one forward, and on a
 * desktop hovering the stack fans it open. Previous and Next buttons do the
 * same for keyboards and anyone who would rather not swipe, and the change is
 * announced to screen readers. Tickets underneath are inert: only the one on
 * top can be reached or read.
 *
 * On the day of a fixture its ticket wears a ring in the highlight colour and
 * a "Match day" mark. That is worked out in the browser, never on the server,
 * because the page is cached and a server's idea of "today" would go stale.
 *
 * Under reduced motion the stack still works, it just changes instantly.
 */

const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 500;

export function FixtureTickets({ fixtures }: { fixtures: Fixture[] }) {
  const reduceMotion = useReducedMotion();
  const [stack, setStack] = useState(fixtures);
  const [fanned, setFanned] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    // Hourly is enough to notice midnight without redrawing for nothing.
    const timer = window.setInterval(update, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const count = stack.length;
  const top = stack[0];
  const stacked = count > 1;

  // Rotating the deck: forward sends the top ticket to the bottom, back brings
  // the bottom ticket to the top.
  function advance(step: 1 | -1) {
    setStack((current) =>
      step === 1
        ? [...current.slice(1), ...current.slice(0, 1)]
        : [...current.slice(-1), ...current.slice(0, -1)],
    );
  }

  if (!top) return null;

  // Where the top ticket falls in date order, for "2 of 3".
  const position = fixtures.findIndex((fixture) => fixture.slug === top.slug) + 1;

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

  // How far each ticket underneath sits below the one above it.
  const offset = fanned ? 26 : 12;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
          {stacked ? "Upcoming fixtures" : "Next match"}
        </p>
        {stacked ? (
          <p className="text-meta tabular-nums text-chalk/70" aria-hidden="true">
            {position} of {count}
          </p>
        ) : null}
      </div>

      <motion.div
        className="relative"
        style={{ paddingBottom: stacked ? (Math.min(count, 3) - 1) * offset : 0 }}
        animate={{ paddingBottom: stacked ? (Math.min(count, 3) - 1) * offset : 0 }}
        transition={spring}
        onHoverStart={() => setFanned(true)}
        onHoverEnd={() => setFanned(false)}
      >
        {stack.slice(0, 3).map((fixture, depth) => {
          const onTop = depth === 0;

          return (
            <motion.div
              key={fixture.slug}
              className={cn(onTop ? "relative" : "absolute inset-x-0 top-0")}
              // Tickets underneath match the top ticket's height exactly; the
              // container's bottom padding is the room they peek out into.
              style={{
                zIndex: 3 - depth,
                touchAction: "pan-y",
                bottom: onTop ? undefined : (Math.min(count, 3) - 1) * offset,
              }}
              initial={false}
              animate={{
                y: depth * offset,
                scale: 1 - depth * 0.04,
                opacity: 1,
              }}
              transition={spring}
              drag={onTop && stacked ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.55}
              onDragEnd={(_, info) => {
                if (
                  Math.abs(info.offset.x) > SWIPE_DISTANCE ||
                  Math.abs(info.velocity.x) > SWIPE_VELOCITY
                ) {
                  advance(info.offset.x < 0 ? 1 : -1);
                }
              }}
              aria-hidden={onTop ? undefined : true}
              inert={!onTop}
            >
              {onTop ? (
                <Ticket fixture={fixture} matchday={now !== null && isMatchday(fixture, now)} />
              ) : (
                <TicketBack fixture={fixture} depth={depth} />
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {stacked ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => advance(-1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-chalk/30 px-4 font-semibold transition active:scale-[0.98]"
          >
            <ArrowLeft aria-hidden="true" weight="bold" className="size-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-chalk/30 px-4 font-semibold transition active:scale-[0.98]"
          >
            Next
            <ArrowRight aria-hidden="true" weight="bold" className="size-4" />
          </button>
          <p className="ml-auto hidden text-meta text-chalk/60 sm:block">Swipe or use the arrows</p>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {stacked
          ? `Fixture ${position} of ${count}: ${sides(top).home} versus ${sides(top).away}`
          : ""}
      </p>

      {/* Only where a kick-off time is confirmed. Counting down to a date
          with no time would be counting to midnight, which is not when
          anybody plays. */}
      {top.kickoff_at ? (
        <div className="mt-4 border border-chalk/25 bg-pitch/85 px-6 py-4 backdrop-blur-sm">
          <Countdown key={top.slug} kickoffAt={top.kickoff_at} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A ticket further down the stack: only its edge shows, so it is drawn as the
 * back of a ticket, a band in its team's colour on card that darkens with
 * depth. Printing its text would show through the ticket on top as clutter.
 */
function TicketBack({ fixture, depth }: { fixture: Fixture; depth: number }) {
  return (
    <div
      aria-hidden="true"
      data-team={toTeamAccentKey(fixture.team.accent_key)}
      className={cn("flex h-full flex-col", depth === 1 ? "bg-turf" : "bg-line")}
    >
      <div className="h-2 bg-accent" />
    </div>
  );
}

function sides(fixture: Fixture): { home: string; away: string } {
  const isAway = fixture.venue === "away";
  return {
    home: isAway ? fixture.opponent.name : fixture.team.name,
    away: isAway ? fixture.team.name : fixture.opponent.name,
  };
}

/**
 * One fixture as a ticket: a band in the team's colour, a stub with the date,
 * a perforation, and the match itself. Printed on chalk so it reads as a
 * physical thing lying on the dark hero.
 */
function Ticket({ fixture, matchday }: { fixture: Fixture; matchday: boolean }) {
  const { home, away } = sides(fixture);
  const date = ticketDate(fixture);
  const kickoff = formatKickoff(fixture.kickoff_at);
  const venueLabel =
    fixture.venue === "away" ? "Away" : fixture.venue === "home" ? "Home" : "Neutral";

  return (
    <article
      data-team={toTeamAccentKey(fixture.team.accent_key)}
      className={cn(
        "relative select-none bg-chalk text-pitch shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7)]",
        matchday && "matchday-ring",
      )}
    >
      {/* Notches punched at both ends of the perforation, in the colour of
          the hero behind, so the ticket reads as cut rather than drawn. */}
      <span
        aria-hidden="true"
        className="absolute -top-2.5 left-[calc(5.5rem-0.625rem)] z-10 size-5 rounded-full bg-pitch sm:left-[calc(6.5rem-0.625rem)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2.5 left-[calc(5.5rem-0.625rem)] z-10 size-5 rounded-full bg-pitch sm:left-[calc(6.5rem-0.625rem)]"
      />
      <header className="flex items-center justify-between gap-3 bg-accent px-5 py-2 text-meta font-semibold text-chalk">
        <span className="truncate">{fixture.competition.short_name}</span>
        <span className="flex shrink-0 items-center gap-2">
          {matchday ? (
            <span className="rounded-control bg-highlight px-2 py-0.5 font-bold uppercase tracking-wide text-on-highlight">
              Match day
            </span>
          ) : null}
          {venueLabel}
        </span>
      </header>

      <div className="grid grid-cols-[5.5rem_1fr] sm:grid-cols-[6.5rem_1fr]">
        {/* The stub. Its right edge is the perforation. */}
        <div className="relative flex flex-col items-center justify-center border-r-2 border-dashed border-line px-2 py-5 text-center">
          {date ? (
            <>
              <span className="text-meta font-semibold uppercase text-muted">{date.weekday}</span>
              <span className="font-display text-5xl font-black leading-none tabular-nums">
                {date.day}
              </span>
              <span className="text-meta font-semibold uppercase tracking-widest">
                {date.month}
              </span>
            </>
          ) : (
            <span className="text-meta font-semibold uppercase text-muted">Date TBC</span>
          )}
          {kickoff ? (
            <span className="mt-2 text-meta font-semibold tabular-nums text-accent-ink">
              {kickoff}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 px-5 py-5">
          <p className="font-display text-2xl font-extrabold uppercase leading-tight">{home}</p>
          <p className="my-1 text-meta font-semibold uppercase tracking-widest text-accent-ink">
            v
          </p>
          <p className="font-display text-2xl font-extrabold uppercase leading-tight">{away}</p>
          {fixture.venue_name ? (
            <p className="mt-3 flex items-center gap-1.5 text-meta text-muted">
              <MapPin aria-hidden="true" weight="bold" className="size-4 shrink-0" />
              <span className="truncate">{fixture.venue_name}</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
