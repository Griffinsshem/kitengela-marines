/**
 * What a delete will do, in words a club volunteer reads once and understands.
 *
 * The API returns counts; these turn them into one sentence per consequence,
 * listing only what applies. Kept free of React so the wording is tested.
 */

type Counts = Record<string, unknown>;

function count(impact: Counts, key: string): number {
  const value = impact[key];
  return typeof value === "number" ? value : 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function describeFixtureDeletion(impact: Counts): string[] {
  const lines: string[] = [];

  const score = impact.score as { ours?: number; theirs?: number } | null | undefined;
  if (impact.has_result === true && score) {
    lines.push(
      `remove the ${score.ours}–${score.theirs} result from the results page and the team's season record`,
    );
  }

  const events = count(impact, "match_events");
  if (events > 0)
    lines.push(
      `remove ${plural(events, "match event", "match events")} (goals, cards, substitutions)`,
    );

  const appearances = count(impact, "appearances");
  if (appearances > 0) {
    lines.push(
      `remove ${plural(appearances, "player appearance", "player appearances")} from players' statistics`,
    );
  }

  const linked = [
    plural(count(impact, "linked_articles"), "article", "articles"),
    plural(count(impact, "linked_galleries"), "gallery", "galleries"),
    plural(count(impact, "linked_videos"), "video", "videos"),
  ].filter((text) => !text.startsWith("0 "));
  if (linked.length > 0) {
    lines.push(`keep ${linked.join(", ")} about it, no longer linked to this match`);
  }

  if (lines.length === 0)
    lines.push("remove it from the fixtures list. Nothing else depends on it");
  return lines.map(capitalise);
}

export function describePlayerDeletion(impact: Counts): string[] {
  const lines: string[] = ["take them off the squad list and remove their profile page"];

  const appearances = count(impact, "appearances");
  if (appearances > 0) {
    lines.push(
      `remove ${plural(appearances, "appearance", "appearances")} from their match records`,
    );
  }

  const events = count(impact, "match_events");
  if (events > 0) {
    lines.push(
      `keep ${plural(events, "goal, card or substitution", "goals, cards and substitutions")} they were part of, without their name`,
    );
  }

  const motm = count(impact, "player_of_the_match");
  if (motm > 0) {
    lines.push(`leave ${plural(motm, "match", "matches")} without a player of the match`);
  }

  if (impact.has_login === true) {
    lines.push("keep their login. Deactivate it under People if they should no longer sign in");
  }

  return lines.map(capitalise);
}

function capitalise(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1) + ".";
}

type FixtureLike = {
  id: string;
  kickoff_at: string | null;
  scheduled_on: string | null;
  team: { short_name: string };
  opponent: { name: string };
};

/**
 * The ids of fixtures that look like the same match entered more than once:
 * same team, same opponent, same day in Kitengela. Undated fixtures are never
 * flagged; two "date to be confirmed" matches against one opponent can both be
 * real (a league game and a cup tie).
 */
export function likelyDuplicates(rows: FixtureLike[], dayOf: (iso: string) => string): Set<string> {
  const groups = new Map<string, string[]>();

  for (const row of rows) {
    const day = row.kickoff_at ? dayOf(row.kickoff_at) : row.scheduled_on;
    if (!day) continue;
    const key = `${row.team.short_name}|${row.opponent.name.trim().toLowerCase()}|${day}`;
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }

  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}
