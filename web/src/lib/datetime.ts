/**
 * Dates and times, always in the club's own timezone.
 *
 * The site is rendered on servers running in UTC. Formatting without an
 * explicit timezone would show a 15:00 kick-off in Kitengela as 12:00 to every
 * supporter, so every formatter here names Africa/Nairobi.
 */

const TIME_ZONE = "Africa/Nairobi";
const LOCALE = "en-GB";

export function formatMatchDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatKickoff(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** A date-only value, e.g. a fixture with no confirmed kick-off time yet. */
export function formatDayMonth(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

/**
 * The calendar day an instant falls on in Kitengela, as YYYY-MM-DD.
 *
 * Comparing these rather than Date objects is what makes "is it match day?"
 * correct at 01:00 local time, when the UTC date is still yesterday.
 */
export function nairobiDayKey(instant: Date): string {
  return DAY_KEY.format(instant);
}

/**
 * Whether a fixture is played on the same Kitengela calendar day as `now`.
 *
 * A fixture with only a date (no kick-off time yet) is still on that date. A
 * fixture with neither is never "today".
 */
export function isMatchday(
  fixture: { kickoff_at: string | null; scheduled_on: string | null },
  now: Date,
): boolean {
  const today = nairobiDayKey(now);
  if (fixture.kickoff_at) return nairobiDayKey(new Date(fixture.kickoff_at)) === today;
  if (fixture.scheduled_on) return fixture.scheduled_on === today;
  return false;
}

/**
 * The parts of a match date printed on a ticket stub: "Sat", "14", "Nov".
 * Taken from the kick-off when there is one, otherwise from the scheduled date.
 */
export function ticketDate(fixture: {
  kickoff_at: string | null;
  scheduled_on: string | null;
}): { weekday: string; day: string; month: string } | null {
  const instant = fixture.kickoff_at
    ? new Date(fixture.kickoff_at)
    : fixture.scheduled_on
      ? new Date(`${fixture.scheduled_on}T12:00:00Z`)
      : null;
  if (!instant || Number.isNaN(instant.getTime())) return null;

  const parts = new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}
