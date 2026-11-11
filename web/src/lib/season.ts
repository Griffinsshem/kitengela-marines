/**
 * A team's season in figures, worked out from its results.
 *
 * The API records results, not running totals, so the team page derives its
 * form guide and season record here. Kept free of React so the arithmetic is
 * tested on its own.
 */

import type { Fixture } from "@/lib/schemas";

export type Outcome = "W" | "D" | "L";

export type FormEntry = {
  slug: string;
  outcome: Outcome;
  /** "Won 2–1 v Rivals FC": what a screen reader says for the pill. */
  description: string;
};

export type SeasonSummary = {
  season: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  /** Whole-number percentage of matches won, 0 when none have been played. */
  winRate: number;
  /** Up to five most recent results, oldest first: the order they happened. */
  form: FormEntry[];
};

const OUTCOME_WORD: Record<Outcome, string> = { W: "Won", D: "Drew", L: "Lost" };

type Played = Fixture & { result: Outcome; our_score: number; their_score: number };

function isPlayed(fixture: Fixture): fixture is Played {
  return (
    fixture.is_completed &&
    (fixture.result === "W" || fixture.result === "D" || fixture.result === "L") &&
    fixture.our_score !== null &&
    fixture.their_score !== null
  );
}

/**
 * Summarise the season of the most recent result.
 *
 * `results` arrive newest first, as the API lists them. Earlier seasons are
 * left out of the record, because a season record that quietly includes last
 * year is wrong. The form guide is the last five results whatever the season,
 * which is how form is read in football. Returns null when nothing has been
 * played, so the page can leave the section out rather than show zeros.
 */
export function summariseSeason(results: Fixture[]): SeasonSummary | null {
  const played = results.filter(isPlayed);
  const latest = played[0];
  if (!latest) return null;

  const season = latest.season;
  const thisSeason = played.filter((fixture) => fixture.season === season);

  const count = (outcome: Outcome) =>
    thisSeason.filter((fixture) => fixture.result === outcome).length;
  const won = count("W");

  const form = played
    .slice(0, 5)
    .reverse()
    .map((fixture) => ({
      slug: fixture.slug,
      outcome: fixture.result,
      description: `${OUTCOME_WORD[fixture.result]} ${fixture.our_score}–${fixture.their_score} v ${fixture.opponent.name}`,
    }));

  return {
    season,
    played: thisSeason.length,
    won,
    drawn: count("D"),
    lost: count("L"),
    goalsFor: thisSeason.reduce((total, fixture) => total + fixture.our_score, 0),
    goalsAgainst: thisSeason.reduce((total, fixture) => total + fixture.their_score, 0),
    cleanSheets: thisSeason.filter((fixture) => fixture.their_score === 0).length,
    winRate: Math.round((won / thisSeason.length) * 100),
    form,
  };
}
