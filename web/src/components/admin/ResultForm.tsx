"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { cn } from "@/lib/cn";

/**
 * Recording a result.
 *
 * Score, line-up and events go to the API in one request, because they are one
 * fact: a partial save would leave a completed match with no scorers, and a
 * supporter refreshing mid-entry would see it.
 *
 * Only the score is required. A rushed Sunday entry can be two numbers; the
 * line-up and events can be filled in later the same way, since resubmitting
 * replaces what was there rather than adding to it.
 */

type SquadPlayer = { id: string; display_name: string; squad_number: number | null };

type Appearance = {
  role: "" | "starter" | "substitute" | "unused_substitute";
  minutes: string;
  goals: string;
  assists: string;
  yellow: string;
  red: string;
};

type EventRow = { type: string; minute: string; player_id: string; is_opposition: boolean };

const EVENT_TYPES = [
  ["goal", "Goal"],
  ["own_goal", "Own goal"],
  ["penalty_scored", "Penalty scored"],
  ["penalty_missed", "Penalty missed"],
  ["yellow_card", "Yellow card"],
  ["second_yellow", "Second yellow"],
  ["red_card", "Red card"],
  ["substitution", "Substitution"],
] as const;

const BLANK_APPEARANCE: Appearance = {
  role: "",
  minutes: "",
  goals: "",
  assists: "",
  yellow: "",
  red: "",
};

const number = (value: string, fallback = 0) => (value === "" ? fallback : Number(value));

export function ResultForm({
  fixtureId,
  teamSlug,
  ourName,
  opponentName,
}: {
  fixtureId: string;
  teamSlug: string;
  ourName: string;
  opponentName: string;
}) {
  const { authFetch } = useAuth();

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [ourScore, setOurScore] = useState("");
  const [theirScore, setTheirScore] = useState("");
  const [report, setReport] = useState("");
  const [motm, setMotm] = useState("");
  const [appearances, setAppearances] = useState<Record<string, Appearance>>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSquad() {
      const response = await authFetch(`/teams/${teamSlug}/players`);
      if (cancelled || !response.ok) return;

      const body: unknown = await response.json();
      const grouped = (body as { data?: Record<string, SquadPlayer[]> }).data ?? {};
      const players = Object.values(grouped).flat();
      if (!cancelled) setSquad(players);
    }

    void loadSquad();
    return () => {
      cancelled = true;
    };
  }, [authFetch, teamSlug]);

  function appearance(playerId: string): Appearance {
    return appearances[playerId] ?? BLANK_APPEARANCE;
  }

  function setAppearance(playerId: string, patch: Partial<Appearance>) {
    setAppearances((current) => ({
      ...current,
      [playerId]: { ...appearance(playerId), ...patch },
    }));
  }

  const starters = Object.values(appearances).filter((entry) => entry.role === "starter").length;

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const lineup = Object.entries(appearances)
      .filter(([, entry]) => entry.role !== "")
      .map(([playerId, entry]) => ({
        player_id: playerId,
        lineup_role: entry.role,
        minutes_played: number(entry.minutes),
        goals: number(entry.goals),
        assists: number(entry.assists),
        yellow_cards: number(entry.yellow),
        red_cards: number(entry.red),
      }));

    const payload: Record<string, unknown> = {
      our_score: number(ourScore),
      their_score: number(theirScore),
      report: report.trim() || null,
      player_of_the_match_id: motm || null,
      lineup: lineup.length > 0 ? lineup : null,
      events:
        events.length > 0
          ? events.map((row) => ({
              event_type: row.type,
              minute: row.minute === "" ? null : Number(row.minute),
              is_opposition: row.is_opposition,
              player_id: row.is_opposition ? null : row.player_id || null,
            }))
          : null,
    };

    const response = await authFetch(`/admin/fixtures/${fixtureId}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { field: string; message: string }[] } })
        ?.error?.details;
      setError(
        details?.length
          ? details.map((d) => `${d.field}: ${d.message}`).join("; ")
          : ((body as { error?: { message?: string } })?.error?.message ??
              "The result could not be saved."),
      );
      return;
    }

    setNotice("Result recorded. It is now on the website.");
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <Field label={ourName} htmlFor="our_score">
          <input
            id="our_score"
            type="number"
            min={0}
            max={30}
            required
            value={ourScore}
            onChange={(event) => setOurScore(event.target.value)}
            className={cn(CONTROL_CLASSES, "text-center font-display text-3xl font-black")}
          />
        </Field>
        <p className="pb-3 text-center font-display text-2xl font-black">–</p>
        <Field label={opponentName} htmlFor="their_score">
          <input
            id="their_score"
            type="number"
            min={0}
            max={30}
            required
            value={theirScore}
            onChange={(event) => setTheirScore(event.target.value)}
            className={cn(CONTROL_CLASSES, "text-center font-display text-3xl font-black")}
          />
        </Field>
      </div>

      <section>
        <h3 className="font-display text-xl font-extrabold uppercase">Line-up</h3>
        <p className="mt-2 text-meta text-muted">
          Optional. Choose a role for anyone involved; leave the rest blank.
          {starters > 11 ? (
            <span className="ml-2 font-semibold text-pitch">
              {starters} starters selected — a starting line-up cannot exceed eleven.
            </span>
          ) : null}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-meta uppercase text-muted">
                <th scope="col" className="py-2 pr-3">Player</th>
                <th scope="col" className="px-2 py-2">Role</th>
                <th scope="col" className="px-2 py-2">Mins</th>
                <th scope="col" className="px-2 py-2">Goals</th>
                <th scope="col" className="px-2 py-2">Assists</th>
                <th scope="col" className="px-2 py-2">Yellow</th>
                <th scope="col" className="px-2 py-2">Red</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((player) => {
                const entry = appearance(player.id);
                const involved = entry.role !== "";
                return (
                  <tr key={player.id} className="border-b border-line">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      <span className="mr-2 tabular-nums text-muted">
                        {player.squad_number ?? "—"}
                      </span>
                      {player.display_name}
                    </th>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Role for ${player.display_name}`}
                        value={entry.role}
                        onChange={(event) =>
                          setAppearance(player.id, {
                            role: event.target.value as Appearance["role"],
                          })
                        }
                        className="w-36 rounded-control border border-line bg-chalk px-2 py-1.5"
                      >
                        <option value="">Not involved</option>
                        <option value="starter">Started</option>
                        <option value="substitute">Came on</option>
                        <option value="unused_substitute">Unused sub</option>
                      </select>
                    </td>
                    {(["minutes", "goals", "assists", "yellow", "red"] as const).map((key) => (
                      <td key={key} className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          aria-label={`${key} for ${player.display_name}`}
                          disabled={!involved}
                          value={entry[key]}
                          onChange={(event) =>
                            setAppearance(player.id, { [key]: event.target.value })
                          }
                          className="w-16 rounded-control border border-line bg-chalk px-2 py-1.5 disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-extrabold uppercase">Match events</h3>
          <button
            type="button"
            onClick={() =>
              setEvents((current) => [
                ...current,
                { type: "goal", minute: "", player_id: "", is_opposition: false },
              ])
            }
            className="rounded-control border border-line bg-chalk px-4 py-2 font-semibold"
          >
            Add an event
          </button>
        </div>
        <p className="mt-2 text-meta text-muted">
          Optional. Goal times and cards, as they happened.
        </p>

        {events.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {events.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center gap-3 border border-line p-3">
                <select
                  aria-label="Event"
                  value={row.type}
                  onChange={(event) =>
                    setEvents((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, type: event.target.value } : item,
                      ),
                    )
                  }
                  className="rounded-control border border-line bg-chalk px-2 py-1.5"
                >
                  {EVENT_TYPES.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  max={130}
                  aria-label="Minute"
                  placeholder="Min"
                  value={row.minute}
                  onChange={(event) =>
                    setEvents((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, minute: event.target.value } : item,
                      ),
                    )
                  }
                  className="w-20 rounded-control border border-line bg-chalk px-2 py-1.5"
                />

                <select
                  aria-label="Player"
                  value={row.is_opposition ? "opposition" : row.player_id}
                  onChange={(event) =>
                    setEvents((current) =>
                      current.map((item, position) =>
                        position === index
                          ? event.target.value === "opposition"
                            ? { ...item, is_opposition: true, player_id: "" }
                            : { ...item, is_opposition: false, player_id: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="rounded-control border border-line bg-chalk px-2 py-1.5"
                >
                  <option value="">Choose a player</option>
                  <option value="opposition">{opponentName}</option>
                  {squad.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.display_name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setEvents((current) => current.filter((_, position) => position !== index))
                  }
                  className="ml-auto text-meta font-semibold underline underline-offset-4"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="Player of the match" htmlFor="motm" hint="Optional.">
          <select
            id="motm"
            value={motm}
            onChange={(event) => setMotm(event.target.value)}
            className={CONTROL_CLASSES}
          >
            <option value="">Nobody selected</option>
            {squad.map((player) => (
              <option key={player.id} value={player.id}>
                {player.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Match report" htmlFor="report" hint="Optional. Plain text.">
          <textarea
            id="report"
            rows={5}
            value={report}
            onChange={(event) => setReport(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="border border-accent-ink bg-chalk px-4 py-3 font-semibold">
          {notice}
        </p>
      ) : null}

      <div className="border-t border-line pt-6">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
        >
          {busy ? "Saving…" : "Record result"}
        </button>
        <p className="mt-3 text-meta text-muted">
          Saving replaces any line-up and events already recorded for this match, so the form can
          be completed in stages.
        </p>
      </div>
    </form>
  );
}
