"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { TEAM_ACCENT_KEYS } from "@/config/teams";
import { cn } from "@/lib/cn";

/**
 * The club's teams.
 *
 * A team is created about as often as the club adds a side, so this is a plain
 * list and one form rather than a section of its own. Everything downstream —
 * squads, fixtures, articles, galleries — points at a team, which is why this
 * page exists at all rather than leaving teams to whoever has database access.
 *
 * The accent key is a dropdown, not free text: it names a colour set defined
 * in the design system, and a value that is not one of those falls back to the
 * club's own colours, which would look like a bug rather than a choice.
 */

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  category: string;
  gender: string;
  accent_key: string;
  summary: string | null;
  is_active: boolean;
  display_order: number;
};

const CATEGORIES = ["senior", "development", "academy", "youth"] as const;
const GENDERS = ["men", "women", "mixed"] as const;

const BLANK = {
  name: "",
  short_name: "",
  category: "senior" as string,
  gender: "men" as string,
  accent_key: "club" as string,
  summary: "",
  display_order: "0",
};

export default function AdminTeamsPage() {
  const { authFetch } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/teams");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setTeams((body as { data?: Team[] }).data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const response = await authFetch("/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        short_name: draft.short_name,
        category: draft.category,
        gender: draft.gender,
        accent_key: draft.accent_key,
        summary: draft.summary.trim() || null,
        display_order: Number(draft.display_order) || 0,
      }),
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
              "The team could not be created."),
      );
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Team }).data;
    if (created) setTeams((current) => [...(current ?? []), created]);

    setDraft(BLANK);
    setNotice("Team created. It is on the website now.");
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Teams</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Squads, fixtures, news and galleries all belong to a team. A team&rsquo;s name can be
        changed later; its address on the website cannot, so it is worth getting right.
      </p>

      <div className="mt-8">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Teams could not be loaded just now.
          </p>
        ) : teams === null ? (
          <p className="text-muted">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="border border-line bg-chalk px-4 py-6 text-center text-muted">
            No teams yet. The first one goes below.
          </p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {teams.map((team) => (
              <li
                key={team.id}
                data-team={team.accent_key}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4"
              >
                <span aria-hidden="true" className="h-4 w-1.5 shrink-0 bg-accent" />
                <span className="font-display text-lg font-extrabold uppercase leading-tight">
                  {team.name}
                </span>
                <span className="text-meta text-muted">{team.short_name}</span>
                <span className="text-meta capitalize text-muted">
                  {team.category} {team.gender}
                </span>
                <span className="text-meta text-muted">/teams/{team.slug}</span>
                {!team.is_active ? (
                  <span className="border border-line px-2 py-0.5 text-meta font-semibold">
                    Not active
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={create} className="mt-10 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Add a team</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" htmlFor="name" hint="As it appears on the website.">
            <input
              id="name"
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Short name" htmlFor="short_name" hint="For tabs and score lines.">
            <input
              id="short_name"
              required
              maxLength={60}
              value={draft.short_name}
              onChange={(event) => setDraft({ ...draft, short_name: event.target.value })}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Colours" htmlFor="accent_key" hint="Which colour set the team's pages use.">
            <select
              id="accent_key"
              value={draft.accent_key}
              onChange={(event) => setDraft({ ...draft, accent_key: event.target.value })}
              className={CONTROL_CLASSES}
            >
              {TEAM_ACCENT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key === "club" ? "Club colours" : key}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category" htmlFor="category">
            <select
              id="category"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              className={CONTROL_CLASSES}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Gender" htmlFor="gender">
            <select
              id="gender"
              value={draft.gender}
              onChange={(event) => setDraft({ ...draft, gender: event.target.value })}
              className={CONTROL_CLASSES}
            >
              {GENDERS.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Order" htmlFor="display_order" hint="Lower numbers come first.">
            <input
              id="display_order"
              type="number"
              min={0}
              max={999}
              value={draft.display_order}
              onChange={(event) => setDraft({ ...draft, display_order: event.target.value })}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <Field
          label="Summary"
          htmlFor="summary"
          hint="Optional. A sentence shown on the team's page."
          className="mt-4"
        >
          <textarea
            id="summary"
            rows={2}
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>

        {error ? (
          <p role="alert" className="mt-4 border border-line px-4 py-3 font-semibold">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-4 border border-accent-ink px-4 py-3 font-semibold">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className={cn(
            "mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight",
            "disabled:opacity-60",
          )}
        >
          {busy ? "Creating…" : "Add team"}
        </button>
      </form>
    </div>
  );
}
