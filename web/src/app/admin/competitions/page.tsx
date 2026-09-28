"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";

/**
 * Competitions and seasons.
 *
 * Every fixture belongs to a season, and every season to a competition, so
 * without these nothing can be scheduled. They are created a handful of times
 * a year — a league, a cup, the friendlies, and a new season each year — which
 * is rare enough to live on one quiet page and far too often to need a
 * developer.
 *
 * Standings are a property of the competition, not of the club: a friendly
 * produces no league table, so a competition that says it has none never
 * shows one.
 */

type Competition = {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  has_standings: boolean;
  is_active: boolean;
};

type Season = {
  id: string;
  label: string;
  competition: string;
  is_current: boolean;
};

export default function AdminCompetitionsPage() {
  const { authFetch } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [hasStandings, setHasStandings] = useState(true);

  const [competitionId, setCompetitionId] = useState("");
  const [label, setLabel] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [competitionResponse, seasonResponse] = await Promise.all([
        authFetch("/admin/competitions"),
        authFetch("/admin/seasons"),
      ]);
      if (cancelled) return;

      if (!competitionResponse.ok) {
        setFailed(true);
        return;
      }

      const competitionBody: unknown = await competitionResponse.json();
      if (!cancelled) {
        setCompetitions((competitionBody as { data?: Competition[] }).data ?? []);
      }

      if (seasonResponse.ok) {
        const seasonBody: unknown = await seasonResponse.json();
        if (!cancelled) setSeasons((seasonBody as { data?: Season[] }).data ?? []);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function readError(response: Response): Promise<string> {
    const body: unknown = await response.json().catch(() => null);
    const details = (body as { error?: { details?: { field: string; message: string }[] } })?.error
      ?.details;
    if (details?.length) return details.map((d) => `${d.field}: ${d.message}`).join("; ");
    return (body as { error?: { message?: string } })?.error?.message ?? "That could not be saved.";
  }

  async function addCompetition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await authFetch("/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, short_name: shortName, has_standings: hasStandings }),
    });

    setBusy(false);

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Competition }).data;
    if (created) {
      setCompetitions((current) => [...(current ?? []), created]);
      // A competition with no season cannot be used, so point at that next.
      setCompetitionId(created.id);
    }

    setName("");
    setShortName("");
    setMessage("Competition added. It now needs a season.");
  }

  async function addSeason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await authFetch("/admin/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competition_id: competitionId, label, is_current: isCurrent }),
    });

    setBusy(false);

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: { id: string; label: string } }).data;
    const competition = competitions?.find((item) => item.id === competitionId);

    if (created && competition) {
      setSeasons((current) => [
        {
          id: created.id,
          label: created.label,
          competition: competition.name,
          is_current: isCurrent,
        },
        ...current,
      ]);
    }

    setLabel("");
    setMessage("Season added. Fixtures can now be scheduled in it.");
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Competitions</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every fixture belongs to a season, and every season to a competition. A league keeps a
        table; a friendly does not.
      </p>

      <div className="mt-8">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Competitions could not be loaded just now.
          </p>
        ) : competitions === null ? (
          <p className="text-muted">Loading…</p>
        ) : competitions.length === 0 ? (
          <p className="border border-line bg-chalk px-4 py-6 text-center text-muted">
            No competitions yet. The first one goes below.
          </p>
        ) : (
          <ul className="space-y-3">
            {competitions.map((competition) => {
              const own = seasons.filter((season) => season.competition === competition.name);
              return (
                <li key={competition.id} className="border border-line bg-chalk px-4 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-display text-lg font-extrabold uppercase leading-tight">
                      {competition.name}
                    </span>
                    <span className="text-meta text-muted">{competition.short_name}</span>
                    <span className="text-meta text-muted">
                      {competition.has_standings ? "Keeps a league table" : "No league table"}
                    </span>
                  </div>

                  {own.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {own.map((season) => (
                        <li
                          key={season.id}
                          className="border border-line px-2 py-0.5 text-meta font-semibold"
                        >
                          {season.label}
                          {season.is_current ? (
                            <span className="ml-2 text-accent-ink">Current</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-meta text-muted">
                      No seasons yet, so nothing can be scheduled in it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {message ? (
        <p role="status" className="mt-6 border border-accent-ink bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <form onSubmit={addCompetition} className="border border-line bg-chalk p-5">
          <h2 className="font-display text-xl font-extrabold uppercase">Add a competition</h2>

          <div className="mt-4 space-y-4">
            <Field label="Name" htmlFor="name" hint="For example, Kajiado County League.">
              <input
                id="name"
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={CONTROL_CLASSES}
              />
            </Field>

            <Field label="Short name" htmlFor="short_name" hint="Shown on match cards.">
              <input
                id="short_name"
                required
                maxLength={60}
                value={shortName}
                onChange={(event) => setShortName(event.target.value)}
                className={CONTROL_CLASSES}
              />
            </Field>

            <label className="flex items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={hasStandings}
                onChange={(event) => setHasStandings(event.target.checked)}
                className="size-5"
              />
              This competition keeps a league table
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-control border border-line px-5 py-2.5 font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Add competition"}
          </button>
        </form>

        <form onSubmit={addSeason} className="border border-line bg-chalk p-5">
          <h2 className="font-display text-xl font-extrabold uppercase">Add a season</h2>

          <div className="mt-4 space-y-4">
            <Field label="Competition" htmlFor="competition">
              <select
                id="competition"
                required
                value={competitionId}
                onChange={(event) => setCompetitionId(event.target.value)}
                className={CONTROL_CLASSES}
              >
                <option value="">Choose a competition</option>
                {(competitions ?? []).map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Season" htmlFor="label" hint="For example, 2026/27.">
              <input
                id="label"
                required
                maxLength={40}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className={CONTROL_CLASSES}
              />
            </Field>

            <label className="flex items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={isCurrent}
                onChange={(event) => setIsCurrent(event.target.checked)}
                className="size-5"
              />
              This is the current season
            </label>
          </div>

          <button
            type="submit"
            disabled={busy || competitions === null || competitions.length === 0}
            className="mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
          >
            {busy ? "Saving…" : "Add season"}
          </button>
        </form>
      </div>
    </div>
  );
}
