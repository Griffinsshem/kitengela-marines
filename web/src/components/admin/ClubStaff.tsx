"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";

/**
 * Coaching and club staff.
 *
 * Staff either belong to one team, like a coach, or to the club as a whole,
 * like the treasurer. The API keeps club-wide staff under the Club Admin's
 * permission alone, so the team dropdown offers both.
 */

const ROLES = [
  ["head_coach", "Head coach"],
  ["assistant_coach", "Assistant coach"],
  ["goalkeeping_coach", "Goalkeeping coach"],
  ["team_manager", "Team manager"],
  ["physio", "Physio"],
  ["treasurer", "Treasurer"],
  ["official", "Club official"],
] as const;

type StaffMember = {
  id: string;
  full_name: string;
  role: string;
  team: { name: string } | null;
};

type Team = { id: string; name: string };

export function ClubStaff() {
  const { authFetch } = useAuth();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<string>("head_coach");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [staffResponse, teamResponse] = await Promise.all([
        authFetch("/staff"),
        authFetch("/teams"),
      ]);
      if (cancelled) return;

      if (staffResponse.ok) {
        const body: unknown = await staffResponse.json();
        if (!cancelled) setStaff((body as { data?: StaffMember[] }).data ?? []);
      }
      if (teamResponse.ok) {
        const body: unknown = await teamResponse.json();
        if (!cancelled) setTeams((body as { data?: Team[] }).data ?? []);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await authFetch("/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        role,
        team_id: teamId || null,
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
              "That person could not be added."),
      );
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: StaffMember }).data;
    if (created) setStaff((current) => [...(current ?? []), created]);

    setFirstName("");
    setLastName("");
  }

  const roleLabel = (value: string) =>
    ROLES.find(([key]) => key === value)?.[1] ?? value.replace(/_/g, " ");

  return (
    <div>
      <form onSubmit={add} className="border border-line bg-chalk p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="First name" htmlFor="staff_first">
            <input
              id="staff_first"
              required
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Last name" htmlFor="staff_last">
            <input
              id="staff_last"
              required
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Role" htmlFor="staff_role">
            <select
              id="staff_role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={CONTROL_CLASSES}
            >
              {ROLES.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Team" htmlFor="staff_team" hint="Or the club as a whole.">
            <select
              id="staff_team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className={CONTROL_CLASSES}
            >
              <option value="">Club-wide</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error ? (
          <p role="alert" className="mt-4 border border-line px-4 py-3 font-semibold">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-control border border-line px-5 py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add a person"}
        </button>
      </form>

      <div className="mt-6">
        {staff === null ? (
          <p className="text-muted">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="border border-line bg-chalk px-4 py-6 text-center text-muted">
            Nobody added yet.
          </p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-baseline gap-x-4 px-4 py-3">
                <span className="font-display text-lg font-extrabold uppercase leading-tight">
                  {member.full_name}
                </span>
                <span className="text-meta font-semibold text-accent-ink">
                  {roleLabel(member.role)}
                </span>
                <span className="text-meta text-muted">
                  {member.team ? member.team.name : "Club-wide"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
