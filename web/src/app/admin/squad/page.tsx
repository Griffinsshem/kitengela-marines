"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { cn } from "@/lib/cn";

type Team = { id: string; name: string; short_name: string; accent_key: string };

type PlayerRow = {
  id: string;
  display_name: string;
  squad_number: number | null;
  position: string;
  status: string;
};

const ORDER = ["goalkeeper", "defender", "midfielder", "forward"];

/**
 * The squad, one team at a time.
 *
 * Team by team rather than one long list, because the API scopes squad
 * management per team: a Starlets coach sees a refusal, not an empty list, if
 * they open the men's squad, and this makes which squad they are looking at
 * unambiguous.
 */
export default function AdminSquadPage() {
  const { authFetch } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<Team | null>(null);
  const [players, setPlayers] = useState<PlayerRow[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      const response = await authFetch("/teams");
      if (cancelled || !response.ok) return;
      const body: unknown = await response.json();
      const rows = (body as { data?: Team[] }).data ?? [];
      if (cancelled) return;
      setTeams(rows);
      setSelected(rows[0] ?? null);
    }

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    async function loadSquad(team: Team) {
      setPlayers(null);
      setProblem(null);

      const response = await authFetch(`/admin/teams/${team.id}/players`);
      if (cancelled) return;

      if (response.status === 403) {
        setProblem("You do not manage this squad.");
        return;
      }
      if (!response.ok) {
        setProblem("The squad could not be loaded just now.");
        return;
      }

      const body: unknown = await response.json();
      if (!cancelled) setPlayers((body as { data?: PlayerRow[] }).data ?? []);
    }

    void loadSquad(selected);
    return () => {
      cancelled = true;
    };
  }, [authFetch, selected]);

  const sorted = [...(players ?? [])].sort((a, b) => {
    const byPosition = ORDER.indexOf(a.position) - ORDER.indexOf(b.position);
    if (byPosition !== 0) return byPosition;
    return (a.squad_number ?? 999) - (b.squad_number ?? 999);
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">Squad</h1>
        <Link
          href="/admin/squad/new"
          className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight"
        >
          Add a player
        </Link>
      </div>

      {teams.length > 1 ? (
        <nav aria-label="Teams" className="mt-6 flex flex-wrap gap-2">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              aria-pressed={selected?.id === team.id}
              onClick={() => setSelected(team)}
              className={cn(
                "rounded-control border px-4 py-2 font-semibold",
                selected?.id === team.id
                  ? "border-accent-ink bg-accent-ink text-chalk"
                  : "border-line bg-chalk hover:bg-turf",
              )}
            >
              {team.short_name}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="mt-8">
        {problem ? (
          <p className="border border-line bg-chalk px-4 py-3">{problem}</p>
        ) : players === null ? (
          <p className="text-muted">Loading…</p>
        ) : players.length === 0 ? (
          <div className="border border-line bg-chalk px-6 py-10 text-center">
            <p className="font-display text-xl font-extrabold uppercase">No players yet</p>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Players added here appear on the team&rsquo;s page on the website.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {sorted.map((player) => (
              <li key={player.id}>
                <Link
                  href={`/admin/squad/${player.id}`}
                  className="flex items-baseline gap-4 px-4 py-4 hover:bg-turf"
                >
                  <span className="w-10 shrink-0 font-display text-xl font-black tabular-nums text-muted">
                    {player.squad_number ?? "—"}
                  </span>
                  <span className="font-display text-lg font-extrabold uppercase leading-tight">
                    {player.display_name}
                  </span>
                  <span className="text-meta capitalize text-muted">{player.position}</span>
                  {player.status !== "active" ? (
                    <span className="border border-line px-2 py-0.5 text-meta font-semibold capitalize">
                      {player.status}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
