/**
 * schema.org descriptions of the club, its teams and its matches, embedded as
 * JSON-LD so search engines can show fixtures and results as rich listings
 * instead of guessing at them from the page text.
 *
 * Built only from data the page already shows: nothing here should ever
 * claim more than a visitor can see.
 */
import type { Club, Fixture, Team } from "./schemas";

const SPORT = "Soccer";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

type Thing = Record<string, unknown>;

function place(club: Pick<Club, "town" | "county"> | null): Thing | undefined {
  const locality = [club?.town, club?.county].filter(Boolean).join(", ");
  return locality
    ? {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: locality,
          addressCountry: "KE",
        },
      }
    : undefined;
}

export function clubJsonLd(club: Club, base = siteUrl): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: club.name,
    alternateName: club.short_name,
    sport: SPORT,
    url: base,
    ...(club.founded_year ? { foundingDate: String(club.founded_year) } : {}),
    ...(club.summary ? { description: club.summary } : {}),
    ...(place(club) ? { location: place(club) } : {}),
    ...(club.hero_image ? { image: club.hero_image.url } : {}),
  };
}

export function teamJsonLd(
  team: Pick<Team, "name" | "slug" | "summary">,
  base = siteUrl,
): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    sport: SPORT,
    url: `${base}/teams/${team.slug}`,
    ...(team.summary ? { description: team.summary } : {}),
  };
}

const EVENT_STATUS: Record<string, string> = {
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
  abandoned: "https://schema.org/EventCancelled",
};

/** A match as a SportsEvent, or null when it has no date: an event needs one. */
export function matchJsonLd(match: Fixture, base = siteUrl): Thing | null {
  const startDate = match.kickoff_at ?? match.scheduled_on;
  if (!startDate) return null;

  const ours = { "@type": "SportsTeam", name: match.team.name };
  const theirs = { "@type": "SportsTeam", name: match.opponent.name };
  const isAway = match.venue === "away";

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${isAway ? match.opponent.name : match.team.name} v ${isAway ? match.team.name : match.opponent.name}`,
    sport: SPORT,
    url: `${base}/matches/${match.slug}`,
    startDate,
    eventStatus:
      EVENT_STATUS[match.status] ?? "https://schema.org/EventScheduled",
    homeTeam: isAway ? theirs : ours,
    awayTeam: isAway ? ours : theirs,
    competitor: [ours, theirs],
    superEvent: {
      "@type": "SportsEvent",
      name: `${match.competition.name} ${match.season}`,
    },
    ...(match.venue_name
      ? { location: { "@type": "Place", name: match.venue_name } }
      : {}),
  };
}

/**
 * The text for a <script type="application/ld+json">. JSON.stringify does not
 * escape "<", so a team or opponent named "</script>…" would end the script
 * element early and inject markup. Escaping it keeps the JSON identical.
 */
export function serializeJsonLd(data: Thing): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
