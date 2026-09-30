"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { formatDate } from "@/lib/datetime";

/**
 * Who can sign in.
 *
 * The password is shown once, here, immediately after the account is made,
 * and is never obtainable again. Whoever creates the account reads it to the
 * person it belongs to; if it is lost, a new one is issued rather than looked
 * up.
 *
 * Accounts are switched off rather than deleted, because the audit log points
 * at them and deleting one would rewrite the club's record of who did what.
 */

type Person = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  roles: string[];
  teams: string[];
};

type Team = { id: string; name: string };

const ROLES = [
  ["club_admin", "Club Admin", "Everything, including accounts."],
  ["media_officer", "Media Officer", "News, photographs and video, across the club."],
  ["team_manager", "Team Manager", "Fixtures, results and squad for chosen teams."],
  ["coach", "Coach", "Squad and player details for chosen teams."],
] as const;

const TEAM_SCOPED = new Set(["team_manager", "coach"]);

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map(([value, label]) => [value, label]),
);

export default function AdminPeoplePage() {
  const { authFetch, user } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [failed, setFailed] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("media_officer");
  const [teamIds, setTeamIds] = useState<string[]>([]);

  const [issued, setIssued] = useState<{ name: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [peopleResponse, teamResponse] = await Promise.all([
        authFetch("/admin/users"),
        authFetch("/teams"),
      ]);
      if (cancelled) return;

      if (!peopleResponse.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await peopleResponse.json();
      if (!cancelled) setPeople((body as { data?: Person[] }).data ?? []);

      if (teamResponse.ok) {
        const teamBody: unknown = await teamResponse.json();
        if (!cancelled) setTeams((teamBody as { data?: Team[] }).data ?? []);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function readError(response: Response): Promise<string> {
    const body: unknown = await response.json().catch(() => null);
    const details = (body as { error?: { details?: { message: string }[] } })?.error?.details;
    if (details?.length) return details.map((d) => d.message).join("; ");
    return (body as { error?: { message?: string } })?.error?.message ?? "That could not be done.";
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setIssued(null);

    const response = await authFetch("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        role,
        team_ids: TEAM_SCOPED.has(role) ? teamIds : [],
      }),
    });

    setBusy(false);

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Person; temporary_password?: string }).data;
    const password = (body as { temporary_password?: string }).temporary_password;

    if (created) setPeople((current) => [...(current ?? []), created]);
    if (created && password) setIssued({ name: created.full_name, password });

    setEmail("");
    setFullName("");
    setTeamIds([]);
  }

  async function setActive(person: Person, active: boolean) {
    setError(null);
    setMessage(null);

    const response = await authFetch(`/admin/users/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const updated = (body as { data?: Person }).data;
    if (updated) {
      setPeople((current) => (current ?? []).map((p) => (p.id === updated.id ? updated : p)));
    }
    setMessage(active ? `${person.full_name} can sign in again.` : `${person.full_name} switched off.`);
  }

  async function resetPassword(person: Person) {
    setError(null);
    setMessage(null);
    setIssued(null);

    const response = await authFetch(`/admin/users/${person.id}/password`, { method: "POST" });

    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    const body: unknown = await response.json();
    const password = (body as { temporary_password?: string }).temporary_password;
    if (password) setIssued({ name: person.full_name, password });
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">People</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Everybody who can sign in to this admin. A password is shown once when it is issued and
        cannot be looked up afterwards, so read it to the person straight away.
      </p>

      {issued ? (
        <div
          role="status"
          className="mt-6 border-2 border-accent-ink bg-chalk p-5"
        >
          <p className="font-display text-xl font-extrabold uppercase">
            Password for {issued.name}
          </p>
          <p className="mt-3 select-all break-all font-display text-3xl font-black tracking-wide">
            {issued.password}
          </p>
          <p className="mt-3 text-meta text-muted">
            This is the only time it is shown. Read it to them now; if it is lost, issue another.
          </p>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="mt-4 rounded-control border border-line px-4 py-2 font-semibold"
          >
            Done
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}

      <div className="mt-8">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            The list of people could not be loaded just now.
          </p>
        ) : people === null ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {people.map((person) => (
              <li key={person.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-4 py-4">
                <span className="font-display text-lg font-extrabold uppercase leading-tight">
                  {person.full_name}
                </span>
                <span className="text-meta text-muted">{person.email}</span>
                <span className="text-meta font-semibold text-accent-ink">
                  {person.roles.map((key) => ROLE_LABEL[key] ?? key).join(", ")}
                </span>
                {person.teams.length > 0 ? (
                  <span className="text-meta text-muted">{person.teams.join(", ")}</span>
                ) : null}
                <span className="text-meta text-muted">
                  {person.last_login_at
                    ? `Last signed in ${formatDate(person.last_login_at)}`
                    : "Never signed in"}
                </span>
                {!person.is_active ? (
                  <span className="border border-line px-2 py-0.5 text-meta font-semibold">
                    Switched off
                  </span>
                ) : null}

                <span className="ml-auto flex gap-4 text-meta font-semibold">
                  <button
                    type="button"
                    onClick={() => void resetPassword(person)}
                    className="underline underline-offset-4"
                  >
                    New password
                  </button>
                  {/* The API refuses this for your own account; the button is
                      hidden as well, so the refusal is never a surprise. */}
                  {person.email !== user?.email ? (
                    <button
                      type="button"
                      onClick={() => void setActive(person, !person.is_active)}
                      className="underline underline-offset-4"
                    >
                      {person.is_active ? "Switch off" : "Switch on"}
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={create} className="mt-10 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Add somebody</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name">
            <input
              id="full_name"
              required
              minLength={2}
              maxLength={160}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Email" htmlFor="email" hint="What they sign in with.">
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <fieldset className="mt-6">
          <legend className="text-meta font-semibold">What they can do</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ROLES.map(([value, label, description]) => (
              <label
                key={value}
                className="flex cursor-pointer gap-3 border border-line p-4 has-[:checked]:border-accent-ink"
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-meta text-muted">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {TEAM_SCOPED.has(role) ? (
          <fieldset className="mt-6">
            <legend className="text-meta font-semibold">Which teams</legend>
            <p className="mt-1 text-meta text-muted">
              This role only works on the teams chosen here, so at least one is required.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 border border-line px-4 py-2">
                  <input
                    type="checkbox"
                    checked={teamIds.includes(team.id)}
                    onChange={(event) =>
                      setTeamIds((current) =>
                        event.target.checked
                          ? [...current, team.id]
                          : current.filter((id) => id !== team.id),
                      )
                    }
                    className="size-4"
                  />
                  <span className="font-semibold">{team.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
