import { describe, expect, it } from "vitest";

import { groupByMonth } from "@/lib/matches";
import type { Fixture } from "@/lib/schemas";

const fixture = (overrides: Partial<Fixture>): Fixture => ({
  slug: "marines-v-rivals",
  status: "scheduled",
  venue: "home",
  venue_name: null,
  kickoff_at: null,
  scheduled_on: null,
  team: {
    name: "Kitengela Marines",
    short_name: "Marines",
    slug: "marines-men",
    accent_key: "marines-men",
  },
  opponent: { name: "Rivals FC", short_name: "Rivals", slug: "rivals-fc", crest_url: null },
  competition: { name: "Kajiado County League", short_name: "County League", slug: "kcl" },
  season: "2026/27",
  our_score: null,
  their_score: null,
  home_score: null,
  away_score: null,
  result: null,
  is_completed: false,
  ...overrides,
});

describe("groupByMonth", () => {
  it("groups fixtures under their month", () => {
    const groups = groupByMonth([
      fixture({ slug: "a", kickoff_at: "2026-10-03T12:00:00+00:00" }),
      fixture({ slug: "b", kickoff_at: "2026-10-17T12:00:00+00:00" }),
      fixture({ slug: "c", kickoff_at: "2026-11-07T12:00:00+00:00" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual(["October 2026", "November 2026"]);
    expect(groups[0]?.fixtures).toHaveLength(2);
  });

  it("uses the scheduled date when there is no confirmed kick-off time", () => {
    const groups = groupByMonth([fixture({ scheduled_on: "2026-10-03" })]);

    expect(groups[0]?.label).toBe("October 2026");
  });

  it("keeps undated fixtures rather than dropping them", () => {
    const groups = groupByMonth([fixture({ slug: "undated" })]);

    expect(groups[0]?.label).toBe("Date to be confirmed");
    expect(groups[0]?.fixtures).toHaveLength(1);
  });

  it("groups by the club's timezone, not the server's", () => {
    // 22:00 UTC on 31 October is 01:00 on 1 November in Kitengela.
    const groups = groupByMonth([fixture({ kickoff_at: "2026-10-31T22:00:00+00:00" })]);

    expect(groups[0]?.label).toBe("November 2026");
  });
});
