/**
 * Grouping matches for display.
 *
 * A long fixture list is unreadable as a flat column of cards, so it is broken
 * by month the way a fixture board is.
 */

import { formatDayMonth } from "@/lib/datetime";
import type { Fixture } from "@/lib/schemas";

export type MatchGroup = { key: string; label: string; fixtures: Fixture[] };

const MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});

/** The date a fixture happens on, whatever form the API supplied it in. */
export function fixtureDate(fixture: Fixture): Date | null {
  if (fixture.kickoff_at) return new Date(fixture.kickoff_at);
  if (fixture.scheduled_on) return new Date(`${fixture.scheduled_on}T12:00:00Z`);
  return null;
}

export function groupByMonth(fixtures: Fixture[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();

  for (const fixture of fixtures) {
    const date = fixtureDate(fixture);
    // A fixture with no date at all is still a fixture; it is collected under
    // its own heading rather than dropped from the list.
    const key = date ? MONTH.format(date) : "date-to-be-confirmed";
    const label = date ? key : "Date to be confirmed";

    const group = groups.get(key);
    if (group) group.fixtures.push(fixture);
    else groups.set(key, { key, label, fixtures: [fixture] });
  }

  return [...groups.values()];
}

export { formatDayMonth };
