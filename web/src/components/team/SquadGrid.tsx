import { PlayerCard } from "@/components/team/PlayerCard";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import type { ApiResult } from "@/lib/api";
import type { Squad } from "@/lib/schemas";

// Goalkeepers first, then out from the back: how a team sheet is read.
const GROUPS = [
  ["goalkeepers", "Goalkeepers"],
  ["defenders", "Defenders"],
  ["midfielders", "Midfielders"],
  ["forwards", "Forwards"],
] as const;

export function SquadGrid({ result }: { result: ApiResult<{ squad: Squad; total: number }> }) {
  if (!result.ok) return <UnavailableState what="The squad" />;

  if (result.data.total === 0) {
    return (
      <EmptyState title="Squad to be announced">
        Players will appear here as the club publishes its squad for the season.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-12">
      {GROUPS.map(([key, label]) => {
        const players = result.data.squad[key];
        if (players.length === 0) return null;

        return (
          <section key={key} aria-labelledby={`squad-${key}`}>
            <h3
              id={`squad-${key}`}
              className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase tracking-wide"
            >
              {label}
            </h3>
            <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {players.map((player) => (
                <li key={player.id}>
                  <PlayerCard player={player} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
