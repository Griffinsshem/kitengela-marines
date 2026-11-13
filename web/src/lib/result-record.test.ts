import { describe, expect, it } from "vitest";

import { BLANK_APPEARANCE, toFormState, toPayload, type RecordedResult } from "@/lib/result-record";

const recorded: RecordedResult = {
  is_completed: true,
  our_score: 2,
  their_score: 1,
  report: "A hard-earned win.",
  player_of_the_match_id: "keeper",
  lineup: [
    {
      player_id: "keeper",
      lineup_role: "starter",
      minutes_played: 90,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      clean_sheet: false,
      goals_conceded: 1,
      saves: 6,
    },
    {
      player_id: "left-the-club",
      lineup_role: "starter",
      minutes_played: 75,
      goals: 1,
      assists: 0,
      yellow_cards: 1,
      red_cards: 0,
      clean_sheet: null,
      goals_conceded: null,
      saves: null,
    },
  ],
  events: [
    {
      event_type: "goal",
      minute: 12,
      added_time: null,
      player_id: "left-the-club",
      related_player_id: "keeper",
      is_opposition: false,
      note: null,
    },
    {
      event_type: "goal",
      minute: 90,
      added_time: 3,
      player_id: null,
      related_player_id: null,
      is_opposition: true,
      note: "Late header",
    },
  ],
  players: {},
};

/** What the API was given, minus the display-only `players` lookup. */
const asSubmitted = (result: RecordedResult) => ({
  our_score: result.our_score,
  their_score: result.their_score,
  report: result.report,
  player_of_the_match_id: result.player_of_the_match_id,
  lineup: result.lineup,
  events: result.events,
});

describe("result form round trip", () => {
  it("opens with the record and saves it back unchanged", () => {
    expect(toPayload(toFormState(recorded))).toEqual(asSubmitted(recorded));
  });

  it("keeps player of the match when only the score is corrected", () => {
    // The original bug: the dropdown opened on "Nobody selected", so any
    // re-save erased the award.
    const state = toFormState(recorded);
    const payload = toPayload({ ...state, ourScore: "3" });

    expect(payload.our_score).toBe(3);
    expect(payload.player_of_the_match_id).toBe("keeper");
  });

  it("adds a forgotten goal without losing the ones already recorded", () => {
    const state = toFormState(recorded);
    const payload = toPayload({
      ...state,
      events: [...state.events, { ...state.events[0]!, minute: "70", related_player_id: null }],
    });

    expect(payload.events).toHaveLength(3);
    expect(payload.events.map((event) => event.minute)).toEqual([12, 90, 70]);
  });

  it("keeps a goalkeeper's figures the form has no boxes for", () => {
    const [keeper] = toPayload(toFormState(recorded)).lineup;
    expect(keeper).toMatchObject({ clean_sheet: false, goals_conceded: 1, saves: 6 });
  });

  it("keeps a player who has since left the squad", () => {
    const ids = toPayload(toFormState(recorded)).lineup.map((entry) => entry.player_id);
    expect(ids).toContain("left-the-club");
  });

  it("drops an appearance only when the role is cleared", () => {
    const state = toFormState(recorded);
    const payload = toPayload({
      ...state,
      appearances: { ...state.appearances, "left-the-club": BLANK_APPEARANCE },
    });

    expect(payload.lineup.map((entry) => entry.player_id)).toEqual(["keeper"]);
  });

  it("shows blank boxes rather than zeros, and reads them back as zero", () => {
    const state = toFormState(recorded);
    expect(state.appearances.keeper?.goals).toBe("");
    expect(toPayload(state).lineup[0]?.goals).toBe(0);
  });

  it("opens an unplayed match empty", () => {
    const state = toFormState({
      ...recorded,
      is_completed: false,
      our_score: null,
      their_score: null,
    });

    expect(state).toEqual({
      ourScore: "",
      theirScore: "",
      report: "",
      motm: "",
      appearances: {},
      events: [],
    });
  });

  it("clears our player from an event switched to the opposition", () => {
    const state = toFormState(recorded);
    const switched = { ...state.events[0]!, is_opposition: true };
    const [event] = toPayload({ ...state, events: [switched] }).events;

    expect(event).toMatchObject({ is_opposition: true, player_id: null, related_player_id: null });
  });
});
