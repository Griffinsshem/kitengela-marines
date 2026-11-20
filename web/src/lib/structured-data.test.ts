import { describe, expect, it } from "vitest";

import type { Fixture } from "./schemas";
import { matchJsonLd, serializeJsonLd, teamJsonLd } from "./structured-data";

const match: Fixture = {
  slug: "marines-v-rovers-2026-03-01",
  status: "scheduled",
  venue: "home",
  venue_name: "Kitengela Stadium",
  kickoff_at: "2026-03-01T15:00:00+03:00",
  scheduled_on: null,
  team: {
    name: "Kitengela Marines",
    short_name: "Marines",
    slug: "marines",
    accent_key: "men",
  },
  opponent: {
    name: "Rovers FC",
    short_name: "Rovers",
    slug: "rovers",
    crest_url: null,
  },
  competition: {
    name: "County League",
    short_name: "CL",
    slug: "county-league",
  },
  season: "2026",
  our_score: null,
  their_score: null,
  home_score: null,
  away_score: null,
  result: null,
  is_completed: false,
};

describe("matchJsonLd", () => {
  it("describes a home fixture with our team at home", () => {
    const data = matchJsonLd(match, "https://site.test");
    expect(data).toMatchObject({
      "@type": "SportsEvent",
      name: "Kitengela Marines v Rovers FC",
      startDate: "2026-03-01T15:00:00+03:00",
      url: "https://site.test/matches/marines-v-rovers-2026-03-01",
      homeTeam: { name: "Kitengela Marines" },
      awayTeam: { name: "Rovers FC" },
      location: { name: "Kitengela Stadium" },
      eventStatus: "https://schema.org/EventScheduled",
    });
  });

  it("puts the opponent at home for an away match", () => {
    const data = matchJsonLd({ ...match, venue: "away" }, "https://site.test");
    expect(data).toMatchObject({
      homeTeam: { name: "Rovers FC" },
      name: "Rovers FC v Kitengela Marines",
    });
  });

  it("marks a postponed match", () => {
    expect(matchJsonLd({ ...match, status: "postponed" })).toMatchObject({
      eventStatus: "https://schema.org/EventPostponed",
    });
  });

  it("falls back to the scheduled day, and gives up without any date", () => {
    expect(
      matchJsonLd({ ...match, kickoff_at: null, scheduled_on: "2026-03-01" }),
    ).toMatchObject({
      startDate: "2026-03-01",
    });
    expect(
      matchJsonLd({ ...match, kickoff_at: null, scheduled_on: null }),
    ).toBeNull();
  });
});

describe("teamJsonLd", () => {
  it("links the team page", () => {
    expect(
      teamJsonLd(
        { name: "Marines Starlets", slug: "starlets", summary: null },
        "https://s.t",
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: "Marines Starlets",
      sport: "Soccer",
      url: "https://s.t/teams/starlets",
    });
  });
});

describe("serializeJsonLd", () => {
  it("cannot be used to close the script element", () => {
    const text = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});
