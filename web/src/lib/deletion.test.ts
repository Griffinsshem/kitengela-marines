import { describe, expect, it } from "vitest";

import { nairobiDayKey } from "@/lib/datetime";
import { describeFixtureDeletion, describePlayerDeletion, likelyDuplicates } from "@/lib/deletion";

const nairobiDayKeyFromIso = (iso: string) => nairobiDayKey(new Date(iso));

describe("fixture deletion wording", () => {
  it("spells out a played match's result, events, appearances and links", () => {
    expect(
      describeFixtureDeletion({
        has_result: true,
        score: { ours: 3, theirs: 1 },
        match_events: 4,
        appearances: 14,
        linked_articles: 1,
        linked_galleries: 0,
        linked_videos: 2,
        requires_confirmation: true,
      }),
    ).toEqual([
      "Remove the 3–1 result from the results page and the team's season record.",
      "Remove 4 match events (goals, cards, substitutions).",
      "Remove 14 player appearances from players' statistics.",
      "Keep 1 article, 2 videos about it, no longer linked to this match.",
    ]);
  });

  it("says plainly when nothing depends on an unplayed fixture", () => {
    expect(
      describeFixtureDeletion({
        has_result: false,
        score: null,
        match_events: 0,
        appearances: 0,
        linked_articles: 0,
        linked_galleries: 0,
        linked_videos: 0,
        requires_confirmation: false,
      }),
    ).toEqual(["Remove it from the fixtures list. Nothing else depends on it."]);
  });

  it("uses the singular for one of anything", () => {
    const [, events] = describeFixtureDeletion({
      has_result: true,
      score: { ours: 1, theirs: 0 },
      match_events: 1,
      requires_confirmation: true,
    });
    expect(events).toBe("Remove 1 match event (goals, cards, substitutions).");
  });
});

describe("player deletion wording", () => {
  it("lists appearances, uncredited events, player of the match and a kept login", () => {
    expect(
      describePlayerDeletion({
        appearances: 6,
        match_events: 2,
        player_of_the_match: 1,
        has_login: true,
        requires_confirmation: true,
      }),
    ).toEqual([
      "Take them off the squad list and remove their profile page.",
      "Remove 6 appearances from their match records.",
      "Keep 2 goals, cards and substitutions they were part of, without their name.",
      "Leave 1 match without a player of the match.",
      "Keep their login. Deactivate it under People if they should no longer sign in.",
    ]);
  });

  it("is a single line for a player who never played", () => {
    expect(
      describePlayerDeletion({
        appearances: 0,
        match_events: 0,
        player_of_the_match: 0,
        has_login: false,
        requires_confirmation: false,
      }),
    ).toEqual(["Take them off the squad list and remove their profile page."]);
  });
});

describe("likely duplicate fixtures", () => {
  const row = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    kickoff_at: "2026-10-03T12:00:00Z",
    scheduled_on: null,
    team: { short_name: "Marines" },
    opponent: { name: "Isinya United" },
    ...overrides,
  });

  it("flags the same team, opponent and Kitengela day, however the time differs", () => {
    const rows = [
      row("a"),
      row("b", { kickoff_at: "2026-10-03T13:30:00Z" }),
      row("c", { kickoff_at: "2026-10-10T12:00:00Z" }),
    ];
    expect([...likelyDuplicates(rows, nairobiDayKeyFromIso)].sort()).toEqual(["a", "b"]);
  });

  it("matches an opponent typed with different capitals or spacing", () => {
    const rows = [row("a"), row("b", { opponent: { name: " isinya united " } })];
    expect(likelyDuplicates(rows, nairobiDayKeyFromIso).size).toBe(2);
  });

  it("does not flag the two teams playing the same opponent on one day", () => {
    const rows = [row("a"), row("b", { team: { short_name: "Starlets" } })];
    expect(likelyDuplicates(rows, nairobiDayKeyFromIso).size).toBe(0);
  });

  it("never flags undated fixtures", () => {
    const rows = [row("a", { kickoff_at: null }), row("b", { kickoff_at: null })];
    expect(likelyDuplicates(rows, nairobiDayKeyFromIso).size).toBe(0);
  });
});
