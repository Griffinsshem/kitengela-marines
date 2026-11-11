import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { Standing } from "@/lib/schemas";

/**
 * The league table.
 *
 * A real table element, so screen readers announce each figure with its column
 * and a supporter can follow a row across. The club's own row is emphasised,
 * but its name is in the row already, so nothing depends on noticing the
 * highlight.
 *
 * On a phone the less important columns are hidden rather than squeezed:
 * position, club, played, goal difference and points are what a supporter
 * checks on the way home from a match.
 *
 * Rows slide in top to bottom as the table scrolls into view, and the club's
 * own row is then swept with a tint in the team accent: the table answers
 * "where are we?" before it is read. Without motion the tint is simply there.
 */
export function LeagueTable({ rows }: { rows: Standing[] }) {
  return (
    // The scroll wrapper names the timeline the rows animate on. The rows
    // cannot use view() directly: the wrapper is itself a scroll container,
    // and a timeline measured against it would never move.
    <div className="table-reveal-scope overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <caption className="sr-only">League standings</caption>
        <thead>
          <tr className="border-b border-line text-meta uppercase tracking-wide text-muted">
            <th scope="col" className="py-3 pr-3 font-semibold">
              <abbr title="Position">Pos</abbr>
            </th>
            <th scope="col" className="py-3 pr-3 font-semibold">
              Club
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              <abbr title="Played">P</abbr>
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold sm:table-cell">
              <abbr title="Won">W</abbr>
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold sm:table-cell">
              <abbr title="Drawn">D</abbr>
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold sm:table-cell">
              <abbr title="Lost">L</abbr>
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold lg:table-cell">
              <abbr title="Goals for">GF</abbr>
            </th>
            <th scope="col" className="hidden px-2 py-3 text-right font-semibold lg:table-cell">
              <abbr title="Goals against">GA</abbr>
            </th>
            <th scope="col" className="px-2 py-3 text-right font-semibold">
              <abbr title="Goal difference">GD</abbr>
            </th>
            <th scope="col" className="py-3 pl-2 text-right font-semibold">
              <abbr title="Points">Pts</abbr>
            </th>
          </tr>
        </thead>
        <tbody className="table-reveal">
          {rows.map((row, index) => (
            <tr
              key={`${row.position}-${row.club.slug}`}
              style={{ "--row": Math.min(index, 15) } as CSSProperties}
              className={cn(
                "border-b border-line tabular-nums",
                row.is_our_club && "row-ours font-semibold",
              )}
            >
              <td className="py-3 pr-3">
                <span
                  className={cn(
                    "inline-block border-l-4 pl-2",
                    row.is_our_club ? "border-accent" : "border-transparent",
                  )}
                >
                  {row.position}
                </span>
              </td>
              <th scope="row" className="py-3 pr-3 font-semibold">
                {row.club.name}
              </th>
              <td className="px-2 py-3 text-right">{row.played}</td>
              <td className="hidden px-2 py-3 text-right sm:table-cell">{row.won}</td>
              <td className="hidden px-2 py-3 text-right sm:table-cell">{row.drawn}</td>
              <td className="hidden px-2 py-3 text-right sm:table-cell">{row.lost}</td>
              <td className="hidden px-2 py-3 text-right lg:table-cell">{row.goals_for}</td>
              <td className="hidden px-2 py-3 text-right lg:table-cell">{row.goals_against}</td>
              <td className="px-2 py-3 text-right">
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="py-3 pl-2 text-right font-display text-lg font-black">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
