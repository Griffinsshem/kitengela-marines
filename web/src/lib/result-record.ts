/**
 * Moving a match result between the API's shape and the result form's fields.
 *
 * The API replaces a match's line-up and events wholesale on every save. So the
 * form must open with everything already recorded and send all of it back;
 * anything it failed to load would be erased. These two functions are that
 * round trip, kept free of React so "load then save changes nothing" is tested
 * directly.
 *
 * Some recorded details have no control in the form (a goalkeeper's saves, an
 * assist linked to a goal, added time, a note). They travel through the form
 * untouched rather than being dropped.
 */

export type LineupRole = "starter" | "substitute" | "unused_substitute";

/** One appearance, as the API stores and accepts it. */
export type RecordedAppearance = {
  player_id: string;
  lineup_role: LineupRole;
  minutes_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean | null;
  goals_conceded: number | null;
  saves: number | null;
};

/** One match event, as the API stores and accepts it. */
export type RecordedEvent = {
  event_type: string;
  minute: number | null;
  added_time: number | null;
  player_id: string | null;
  related_player_id: string | null;
  is_opposition: boolean;
  note: string | null;
};

export type NamedPlayer = {
  display_name: string;
  squad_number: number | null;
  status: string;
};

/** What the admin fixture endpoint returns about a match's result. */
export type RecordedResult = {
  is_completed: boolean;
  our_score: number | null;
  their_score: number | null;
  report: string | null;
  player_of_the_match_id: string | null;
  lineup: RecordedAppearance[];
  events: RecordedEvent[];
  players: Record<string, NamedPlayer>;
};

/** A line-up row as the form edits it: text boxes hold strings. */
export type Appearance = {
  role: "" | LineupRole;
  minutes: string;
  goals: string;
  assists: string;
  yellow: string;
  red: string;
  // Carried through untouched; the form has no controls for these.
  clean_sheet: boolean | null;
  goals_conceded: number | null;
  saves: number | null;
};

export type EventRow = {
  type: string;
  minute: string;
  player_id: string;
  is_opposition: boolean;
  // Carried through untouched; the form has no controls for these.
  added_time: number | null;
  related_player_id: string | null;
  note: string | null;
};

export type ResultFormState = {
  ourScore: string;
  theirScore: string;
  report: string;
  motm: string;
  appearances: Record<string, Appearance>;
  events: EventRow[];
};

export const BLANK_APPEARANCE: Appearance = {
  role: "",
  minutes: "",
  goals: "",
  assists: "",
  yellow: "",
  red: "",
  clean_sheet: null,
  goals_conceded: null,
  saves: null,
};

export const BLANK_EVENT: EventRow = {
  type: "goal",
  minute: "",
  player_id: "",
  is_opposition: false,
  added_time: null,
  related_player_id: null,
  note: null,
};

/** A count as a text box shows it: blank rather than a column of zeros. */
const box = (value: number) => (value === 0 ? "" : String(value));

/** A text box back to a count; blank means none. */
const count = (value: string) => (value.trim() === "" ? 0 : Number(value));

/** The form's starting fields: blank for an unplayed match, otherwise the record. */
export function toFormState(recorded: RecordedResult): ResultFormState {
  if (!recorded.is_completed) {
    return { ourScore: "", theirScore: "", report: "", motm: "", appearances: {}, events: [] };
  }

  const appearances: Record<string, Appearance> = {};
  for (const entry of recorded.lineup) {
    appearances[entry.player_id] = {
      role: entry.lineup_role,
      minutes: box(entry.minutes_played),
      goals: box(entry.goals),
      assists: box(entry.assists),
      yellow: box(entry.yellow_cards),
      red: box(entry.red_cards),
      clean_sheet: entry.clean_sheet,
      goals_conceded: entry.goals_conceded,
      saves: entry.saves,
    };
  }

  return {
    ourScore: recorded.our_score === null ? "" : String(recorded.our_score),
    theirScore: recorded.their_score === null ? "" : String(recorded.their_score),
    report: recorded.report ?? "",
    motm: recorded.player_of_the_match_id ?? "",
    appearances,
    events: recorded.events.map((event) => ({
      type: event.event_type,
      minute: event.minute === null ? "" : String(event.minute),
      player_id: event.player_id ?? "",
      is_opposition: event.is_opposition,
      added_time: event.added_time,
      related_player_id: event.related_player_id,
      note: event.note,
    })),
  };
}

/**
 * The complete result to send. Line-up and events are always sent in full,
 * even when empty: the form shows the whole record, so what is on screen is
 * exactly what should be stored.
 */
export function toPayload(state: ResultFormState) {
  return {
    our_score: count(state.ourScore),
    their_score: count(state.theirScore),
    report: state.report.trim() || null,
    player_of_the_match_id: state.motm || null,
    lineup: Object.entries(state.appearances)
      .filter(([, entry]) => entry.role !== "")
      .map(([playerId, entry]) => ({
        player_id: playerId,
        lineup_role: entry.role as LineupRole,
        minutes_played: count(entry.minutes),
        goals: count(entry.goals),
        assists: count(entry.assists),
        yellow_cards: count(entry.yellow),
        red_cards: count(entry.red),
        clean_sheet: entry.clean_sheet,
        goals_conceded: entry.goals_conceded,
        saves: entry.saves,
      })),
    events: state.events.map((row) => ({
      event_type: row.type,
      minute: row.minute.trim() === "" ? null : Number(row.minute),
      added_time: row.added_time,
      is_opposition: row.is_opposition,
      player_id: row.is_opposition ? null : row.player_id || null,
      related_player_id: row.is_opposition ? null : row.related_player_id,
      note: row.note,
    })),
  };
}
