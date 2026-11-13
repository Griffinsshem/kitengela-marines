"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { cn } from "@/lib/cn";
import {
  BLANK_APPEARANCE,
  BLANK_EVENT,
  toFormState,
  toPayload,
  type Appearance,
  type EventRow,
  type RecordedResult,
} from "@/lib/result-record";

/**
 * Recording a result, or correcting one.
 *
 * Score, line-up and events go to the API in one request, because they are one
 * fact: a partial save would leave a completed match with no scorers, and a
 * supporter refreshing mid-entry would see it.
 *
 * The API replaces a match's line-up and events on every save, so this form
 * opens with everything already recorded and sends it all back. What is on
 * screen is exactly what gets stored: correcting a score keeps the scorers,
 * adding a forgotten goal keeps the others, and only what is removed here is
 * removed. Details the form has no boxes for (a goalkeeper's saves, an assist
 * linked to a goal, added time) travel through untouched; see
 * `lib/result-record.ts`.
 *
 * Players who appear in the record but have since left the squad are still
 * listed, marked as such, so their part in the match is not lost on save.
 *
 * Only the score is required. A rushed Sunday entry can be two numbers; the
 * rest can be added later the same way.
 */

type SquadPlayer = { id: string; display_name: string; squad_number: number | null };

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

export function ResultForm({
  fixtureId,
  teamSlug,
  ourName,
  opponentName,
  recorded,
}: {
  fixtureId: string;
  teamSlug: string;
  ourName: string;
  opponentName: string;
  /** What is already stored for this match; blank fields for an unplayed one. */
  recorded: RecordedResult;
}) {
  const { authFetch } = useAuth();

  // Every field starts from the record, so nothing is lost by saving.
  const [initial] = useState(() => toFormState(recorded));
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [ourScore, setOurScore] = useState(initial.ourScore);
  const [theirScore, setTheirScore] = useState(initial.theirScore);
  const [report, setReport] = useState(initial.report);
  const [motm, setMotm] = useState(initial.motm);
  const [appearances, setAppearances] = useState<Record<string, Appearance>>(initial.appearances);
  const [events, setEvents] = useState<EventRow[]>(initial.events);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [squadState, setSquadState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadSquad() {
      const response = await authFetch(`/teams/${teamSlug}/players`);
      if (cancelled) return;
      if (!response.ok) {
        setSquadState("failed");
        return;
      }

      const body: unknown = await response.json();
      const grouped = (body as { data?: Record<string, SquadPlayer[]> }).data ?? {};
      const players = Object.values(grouped).flat();
      if (cancelled) return;
      setSquad(players);
      setSquadState("ready");
    }

    void loadSquad();
    return () => {
      cancelled = true;
    };
  }, [authFetch, teamSlug]);

  // Players named in the record but not in the squad list: usually people who
  // have since left. They are listed after the squad and offered in the
  // pickers, so a saved match keeps them. (If the squad failed to load, this
  // is everyone in the record, which still keeps the record intact.)
  const departed = useMemo<SquadPlayer[]>(() => {
    const inSquad = new Set(squad.map((player) => player.id));
    return Object.entries(recorded.players)
      .filter(([id]) => !inSquad.has(id))
      .map(([id, player]) => ({
        id,
        display_name: player.display_name,
        squad_number: player.squad_number,
      }));
  }, [recorded.players, squad]);
  const everyone = [...squad, ...departed];

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

    const payload = toPayload({ ourScore, theirScore, report, motm, appearances, events });

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

    setNotice("Result saved. It is now on the website.");
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

        {squadState === "loading" ? <p className="mt-4 text-muted">Loading the squad…</p> : null}
        {squadState === "failed" ? (
          <p role="alert" className="mt-4 border border-line bg-chalk px-4 py-3">
            The squad could not be loaded, so only players already recorded for this match are
            listed. Saving keeps them.
          </p>
        ) : null}

        <div className={cn("mt-4 overflow-x-auto", squadState === "loading" && "hidden")}>
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-meta uppercase text-muted">
                <th scope="col" className="py-2 pr-3">
                  Player
                </th>
                <th scope="col" className="px-2 py-2">
                  Role
                </th>
                <th scope="col" className="px-2 py-2">
                  Mins
                </th>
                <th scope="col" className="px-2 py-2">
                  Goals
                </th>
                <th scope="col" className="px-2 py-2">
                  Assists
                </th>
                <th scope="col" className="px-2 py-2">
                  Yellow
                </th>
                <th scope="col" className="px-2 py-2">
                  Red
                </th>
              </tr>
            </thead>
            <tbody>
              {[...squad, ...departed.filter((player) => player.id in appearances)].map(
                (player) => {
                  const entry = appearance(player.id);
                  const left =
                    squadState === "ready" && !squad.some((member) => member.id === player.id);
                  const involved = entry.role !== "";
                  return (
                    <tr key={player.id} className="border-b border-line">
                      <th scope="row" className="py-2 pr-3 font-semibold">
                        <span className="mr-2 tabular-nums text-muted">
                          {player.squad_number ?? "—"}
                        </span>
                        {player.display_name}
                        {left ? (
                          <span className="ml-2 text-meta font-normal text-muted">
                            No longer in the squad
                          </span>
                        ) : null}
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
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-extrabold uppercase">Match events</h3>
          <button
            type="button"
            onClick={() => setEvents((current) => [...current, { ...BLANK_EVENT }])}
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
                            ? {
                                ...item,
                                is_opposition: true,
                                player_id: "",
                                related_player_id: null,
                              }
                            : { ...item, is_opposition: false, player_id: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="rounded-control border border-line bg-chalk px-2 py-1.5"
                >
                  <option value="">Player not named</option>
                  <option value="opposition">{opponentName}</option>
                  {everyone.map((player) => (
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
            {everyone.map((player) => (
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
          {busy ? "Saving…" : recorded.is_completed ? "Save result" : "Record result"}
        </button>
        <p className="mt-3 text-meta text-muted">
          {recorded.is_completed
            ? "This form shows what is recorded. Saving stores exactly what is shown here, so anything removed above is removed from the match."
            : "Only the score is needed now. The line-up and events can be added later from this page."}
        </p>
      </div>
    </form>
  );
}
