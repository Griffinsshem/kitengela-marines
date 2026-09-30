"use client";

import { useEffect, useState } from "react";

/**
 * How long until kick-off.
 *
 * Rendered nowhere on the server. The time remaining depends on when the page
 * is looked at, and a server-rendered figure would be baked into a cached page
 * and served stale for as long as that page lives — "in 3 days" still showing
 * on match day. So this stays empty until the browser has it right.
 *
 * Counted in minutes rather than seconds. A supporter checking whether they
 * have time to get to the ground does not need a ticking clock, and a figure
 * that changes every second is movement without information.
 */

type Remaining = { days: number; hours: number; minutes: number } | "imminent" | "started" | null;

function remainingUntil(kickoff: Date): Remaining {
  const ms = kickoff.getTime() - Date.now();

  // Ninety minutes plus stoppages and a half-time: after that the match is
  // over and the result is the news, not the countdown.
  if (ms < -2 * 60 * 60 * 1000) return null;
  if (ms <= 0) return "started";
  if (ms < 60 * 1000) return "imminent";

  const minutes = Math.floor(ms / 60000);
  return {
    days: Math.floor(minutes / (60 * 24)),
    hours: Math.floor((minutes % (60 * 24)) / 60),
    minutes: minutes % 60,
  };
}

function describe(remaining: Exclude<Remaining, null | "imminent" | "started">): string {
  const { days, hours, minutes } = remaining;
  // Two units at most: "2 days 5 hours" reads; "2 days 5 hours 13 minutes"
  // is a stopwatch, and the smallest unit is noise beside the largest.
  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function Countdown({
  kickoffAt,
  tone = "dark",
}: {
  kickoffAt: string;
  tone?: "dark" | "light";
}) {
  const [remaining, setRemaining] = useState<Remaining>(null);

  useEffect(() => {
    const kickoff = new Date(kickoffAt);
    if (Number.isNaN(kickoff.getTime())) return;

    const tick = () => setRemaining(remainingUntil(kickoff));
    tick();

    // Every fifteen seconds, so the minute figure is never more than that out
    // of date, without redrawing constantly.
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, [kickoffAt]);

  if (remaining === null) return null;

  const muted = tone === "dark" ? "text-chalk/60" : "text-muted";
  const accent = tone === "dark" ? "text-accent-glow" : "text-accent-ink";

  if (remaining === "started") {
    return (
      <p className={`text-meta font-semibold uppercase tracking-widest ${accent}`}>
        Kick-off has passed
      </p>
    );
  }

  return (
    <div>
      <p className={`text-meta ${muted}`}>
        {remaining === "imminent" ? "Kicking off" : "Kicks off in"}
      </p>
      <p className="mt-1 font-display text-2xl font-black uppercase tabular-nums">
        {remaining === "imminent" ? "Any moment" : describe(remaining)}
      </p>
    </div>
  );
}
