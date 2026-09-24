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
