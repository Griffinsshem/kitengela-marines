"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";

/**
 * Scheduling a match.
 *
 * Kick-off is entered as a date and a time in Kenyan time and sent with an
 * explicit +03:00 offset. Without the offset the API would read 15:00 as UTC
 * and every supporter would be told the wrong time by three hours.
 *
 * A county league often announces the date before confirming a kick-off time,
 * so the time may be left blank: the fixture then carries a date only, and the
 * site says the time is to be confirmed rather than inventing one.
 */

type Option = { id: string; label: string };

export type FixtureDraft = {
  id?: string;
  team_id: string;
  season_id: string;
  opponent_id: string;
  venue: string;
  venue_name: string;
  date: string;
  time: string;
  status: string;
};

export const BLANK_FIXTURE: FixtureDraft = {
  team_id: "",
  season_id: "",
  opponent_id: "",
  venue: "home",
  venue_name: "",
  date: "",
  time: "",
  status: "scheduled",
};

// Editable states. A fixture becomes 'completed' only by recording a result,
// which is a different operation with a score attached.
const STATUSES = ["scheduled", "postponed", "cancelled"] as const;

export function FixtureForm({ initial }: { initial?: FixtureDraft }) {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [draft, setDraft] = useState<FixtureDraft>(initial ?? BLANK_FIXTURE);
  const [teams, setTeams] = useState<Option[]>([]);
  const [seasons, setSeasons] = useState<Option[]>([]);
  const [opponents, setOpponents] = useState<Option[]>([]);
  const [newOpponent, setNewOpponent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isNew = !draft.id;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [teamResponse, seasonResponse, opponentResponse] = await Promise.all([
        authFetch("/teams"),
        authFetch("/admin/seasons"),
        authFetch("/admin/opponents"),
      ]);
      if (cancelled) return;

      if (teamResponse.ok) {
        const body: unknown = await teamResponse.json();
        const rows = (body as { data?: { id: string; name: string }[] }).data ?? [];
        if (!cancelled) setTeams(rows.map((row) => ({ id: row.id, label: row.name })));
      }

      if (seasonResponse.ok) {
        const body: unknown = await seasonResponse.json();
        const rows =
          (body as { data?: { id: string; label: string; competition: string }[] }).data ?? [];
        if (!cancelled) {
          setSeasons(rows.map((row) => ({ id: row.id, label: `${row.competition} ${row.label}` })));
        }
      }

      if (opponentResponse.ok) {
        const body: unknown = await opponentResponse.json();
        const rows = (body as { data?: { id: string; name: string }[] }).data ?? [];
        if (!cancelled) setOpponents(rows.map((row) => ({ id: row.id, label: row.name })));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  function set(field: keyof FixtureDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function readError(response: Response): Promise<string> {
    const body: unknown = await response.json().catch(() => null);
    const details = (body as { error?: { details?: { field: string; message: string }[] } })?.error
      ?.details;
    if (details?.length) return details.map((d) => `${d.field}: ${d.message}`).join("; ");
    return (body as { error?: { message?: string } })?.error?.message ?? "That could not be saved.";
  }

  async function addOpponent() {
    const name = newOpponent.trim();
    if (!name) return;

    setBusy(true);
    const response = await authFetch("/admin/opponents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: { id: string; name: string } }).data;
    if (!created) return;

    setOpponents((current) => [...current, { id: created.id, label: created.name }]);
    set("opponent_id", created.id);
    setNewOpponent("");
    setNotice(`${created.name} added.`);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    // Kenyan time, stated explicitly. The API stores the instant; without the
    // offset it would assume UTC and shift every kick-off by three hours.
    const kickoff = draft.date && draft.time ? `${draft.date}T${draft.time}:00+03:00` : null;
    const scheduled = draft.date && !draft.time ? draft.date : null;

    const payload: Record<string, unknown> = {
      opponent_id: draft.opponent_id,
      venue: draft.venue,
      venue_name: draft.venue_name.trim() || null,
      kickoff_at: kickoff,
      scheduled_on: scheduled,
    };

    if (isNew) {
      payload.team_id = draft.team_id;
      payload.season_id = draft.season_id;
    } else {
      payload.status = draft.status;
    }

    const response = isNew
      ? await authFetch("/admin/fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await authFetch(`/admin/fixtures/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setBusy(false);

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const saved = (body as { data?: { id?: string } }).data;

    if (isNew && saved?.id) {
      router.replace(`/admin/fixtures/${saved.id}`);
      return;
    }
    setNotice("Saved.");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isNew ? (
          <>
            <Field label="Team" htmlFor="team">
              <select
                id="team"
                required
                value={draft.team_id}
                onChange={(event) => set("team_id", event.target.value)}
                className={CONTROL_CLASSES}
              >
                <option value="">Choose a team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Competition and season" htmlFor="season">
              <select
                id="season"
                required
                value={draft.season_id}
                onChange={(event) => set("season_id", event.target.value)}
                className={CONTROL_CLASSES}
              >
                <option value="">Choose a season</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.label}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Status" htmlFor="status" hint="A result is recorded separately, below.">
            <select
              id="status"
              value={draft.status}
              onChange={(event) => set("status", event.target.value)}
              className={CONTROL_CLASSES}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Opponent" htmlFor="opponent">
          <select
            id="opponent"
            required
            value={draft.opponent_id}
            onChange={(event) => set("opponent_id", event.target.value)}
            className={CONTROL_CLASSES}
          >
            <option value="">Choose an opponent</option>
            {opponents.map((opponent) => (
              <option key={opponent.id} value={opponent.id}>
                {opponent.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Venue" htmlFor="venue">
          <select
            id="venue"
            value={draft.venue}
            onChange={(event) => set("venue", event.target.value)}
            className={CONTROL_CLASSES}
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>

        <Field label="Ground" htmlFor="venue_name" hint="Optional.">
          <input
            id="venue_name"
            maxLength={160}
            value={draft.venue_name}
            onChange={(event) => set("venue_name", event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Date" htmlFor="date">
          <input
            id="date"
            type="date"
            required
            value={draft.date}
            onChange={(event) => set("date", event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field
          label="Kick-off time"
          htmlFor="time"
          hint="Kenyan time. Leave blank if it is not confirmed yet."
        >
          <input
            id="time"
            type="time"
            value={draft.time}
            onChange={(event) => set("time", event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>
      </div>

      <fieldset className="border border-line bg-chalk p-4">
        <legend className="px-2 text-meta font-semibold">Opponent not listed?</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label htmlFor="new_opponent" className="block text-meta font-semibold">
              Club name
            </label>
            <input
              id="new_opponent"
              maxLength={160}
              value={newOpponent}
              onChange={(event) => setNewOpponent(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </div>
          <button
            type="button"
            disabled={busy || newOpponent.trim() === ""}
            onClick={() => void addOpponent()}
            className="rounded-control border border-line px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            Add opponent
          </button>
        </div>
      </fieldset>

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
          {busy ? "Saving…" : isNew ? "Add fixture" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
