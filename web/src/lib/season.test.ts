import { describe, expect, it } from "vitest";

import type { Fixture } from "@/lib/schemas";
import { summariseSeason } from "@/lib/season";

let counter = 0;

const result = (
  outcome: "W" | "D" | "L",
  ours: number,
  theirs: number,
  overrides: Partial<Fixture> = {},
): Fixture => {
  counter += 1;
  return {
    slug: `match-${counter}`,
    status: "completed",
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
    opponent: { name: `Rivals ${counter}`, short_name: "Rivals", slug: "rivals", crest_url: null },
    competition: { name: "Kajiado County League", short_name: "County League", slug: "kcl" },
    season: "2026/27",
    our_score: ours,
    their_score: theirs,
    home_score: ours,
    away_score: theirs,
    result: outcome,
    is_completed: true,
    ...overrides,
  };
};

describe("season summary", () => {
  it("returns nothing when no match has been played, so the section is left out", () => {
    expect(summariseSeason([])).toBeNull();
    expect(
      summariseSeason([
        result("W", 1, 0, {
          is_completed: false,
          result: null,
          our_score: null,
          their_score: null,
        }),
      ]),
    ).toBeNull();
  });

  it("totals the record, goals and clean sheets", () => {
    const summary = summariseSeason([
      result("W", 3, 0),
      result("D", 1, 1),
      result("L", 0, 2),
      result("W", 2, 1),
    ]);

    expect(summary).toMatchObject({
      season: "2026/27",
      played: 4,
      won: 2,
      drawn: 1,
      lost: 1,
      goalsFor: 6,
      goalsAgainst: 4,
      cleanSheets: 1,
      winRate: 50,
    });
  });

  it("counts only the current season in the record", () => {
    const summary = summariseSeason([result("W", 1, 0), result("L", 0, 4, { season: "2025/26" })]);

    expect(summary?.played).toBe(1);
    expect(summary?.goalsAgainst).toBe(0);
    expect(summary?.winRate).toBe(100);
  });

  it("reads the form guide oldest first, five at most, across seasons", () => {
    // Newest first, as the API lists results.
    const newestFirst = [
      result("W", 2, 0),
      result("W", 1, 0),
      result("D", 0, 0),
      result("L", 1, 3),
      result("W", 4, 1),
      result("L", 0, 1, { season: "2025/26" }),
    ];

    const form = summariseSeason(newestFirst)?.form ?? [];

    expect(form.map((entry) => entry.outcome)).toEqual(["W", "L", "D", "W", "W"]);
    expect(form[1]?.description).toBe(`Lost 1–3 v ${newestFirst[3]?.opponent.name}`);
  });

  it("describes each result in words, not just a letter", () => {
    const [entry] = summariseSeason([result("D", 2, 2)])?.form ?? [];
    expect(entry?.description).toMatch(/^Drew 2–2 v Rivals \d+$/);
  });
});
