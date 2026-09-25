"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Image from "next/image";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { MediaPicker } from "@/components/admin/MediaPicker";

/**
 * Adding and editing a player.
 *
 * The form is in two halves, and the split is the point. Everything above the
 * divider appears on the website. Everything below it — date of birth, phone,
 * next of kin — is club record-keeping that no public endpoint returns, and
 * the form says so rather than leaving whoever types it to guess.
 */

const POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
const STATUSES = ["active", "injured", "suspended", "inactive", "former"] as const;

export type PlayerDraft = {
  id?: string;
  team_id: string;
  first_name: string;
  last_name: string;
  known_as: string;
  squad_number: string;
  position: string;
  status: string;
  nationality: string;
  joined_on: string;
  biography: string;
  photo_url: string;
  date_of_birth: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  internal_notes: string;
};

export const BLANK_PLAYER: PlayerDraft = {
  team_id: "",
  first_name: "",
  last_name: "",
  known_as: "",
  squad_number: "",
  position: "midfielder",
  status: "active",
  nationality: "",
  joined_on: "",
  biography: "",
  photo_url: "",
  date_of_birth: "",
  phone: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  internal_notes: "",
};

type Team = { id: string; name: string };

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PlayerForm({ initial }: { initial?: PlayerDraft }) {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [draft, setDraft] = useState<PlayerDraft>(initial ?? BLANK_PLAYER);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isNew = !draft.id;

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      const response = await authFetch("/teams");
      if (cancelled || !response.ok) return;
      const body: unknown = await response.json();
      const rows = (body as { data?: Team[] }).data ?? [];
      if (!cancelled) setTeams(rows);
    }

    void loadTeams();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  function set(field: keyof PlayerDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    // Empty text means "not recorded", which the API stores as null. An empty
    // string would put a blank where a missing value belongs.
    const optional = (value: string) => (value.trim() === "" ? null : value.trim());
    const payload: Record<string, unknown> = {
      first_name: draft.first_name,
      last_name: draft.last_name,
      known_as: optional(draft.known_as),
      squad_number: draft.squad_number === "" ? null : Number(draft.squad_number),
      position: draft.position,
      status: draft.status,
      nationality: optional(draft.nationality),
      joined_on: optional(draft.joined_on),
      biography: optional(draft.biography),
      photo_url: optional(draft.photo_url),
      date_of_birth: optional(draft.date_of_birth),
      phone: optional(draft.phone),
      emergency_contact_name: optional(draft.emergency_contact_name),
      emergency_contact_phone: optional(draft.emergency_contact_phone),
      internal_notes: optional(draft.internal_notes),
    };

    // team_id is only accepted on create. Moving a player between squads is a
    // transfer, with its own endpoint and its own permission check.
    if (isNew) payload.team_id = draft.team_id;

    const response = isNew
      ? await authFetch("/admin/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await authFetch(`/admin/players/${draft.id}`, {
          method: "PATCH",
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
              "That could not be saved."),
      );
      return;
    }

    const body: unknown = await response.json();
    const saved = (body as { data?: { id?: string } }).data;

    if (isNew && saved?.id) {
      router.replace(`/admin/squad/${saved.id}`);
      return;
    }
    setNotice("Saved.");
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isNew ? (
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
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="First name" htmlFor="first_name">
            <input
              id="first_name"
              required
              maxLength={80}
              value={draft.first_name}
              onChange={(event) => set("first_name", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Last name" htmlFor="last_name">
            <input
              id="last_name"
              required
              maxLength={80}
              value={draft.last_name}
              onChange={(event) => set("last_name", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Known as" htmlFor="known_as" hint="Optional. The name supporters use.">
            <input
              id="known_as"
              maxLength={120}
              value={draft.known_as}
              onChange={(event) => set("known_as", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Squad number" htmlFor="squad_number" hint="1 to 99, or leave blank.">
            <input
              id="squad_number"
              type="number"
              min={1}
              max={99}
              value={draft.squad_number}
              onChange={(event) => set("squad_number", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Position" htmlFor="position">
            <select
              id="position"
              value={draft.position}
              onChange={(event) => set("position", event.target.value)}
              className={CONTROL_CLASSES}
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {label(position)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" htmlFor="status" hint="Former players stay in the records.">
            <select
              id="status"
              value={draft.status}
              onChange={(event) => set("status", event.target.value)}
              className={CONTROL_CLASSES}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nationality" htmlFor="nationality">
            <input
              id="nationality"
              maxLength={80}
              value={draft.nationality}
              onChange={(event) => set("nationality", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="At the club since" htmlFor="joined_on">
            <input
              id="joined_on"
              type="date"
              value={draft.joined_on}
              onChange={(event) => set("joined_on", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <Field label="Profile" htmlFor="biography" hint="Shown on the player's page. Plain text.">
          <textarea
            id="biography"
            rows={4}
            value={draft.biography}
            onChange={(event) => set("biography", event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <div className="border border-line bg-chalk p-4">
          <p className="text-meta font-semibold">Photograph</p>
          <p className="mt-1 text-meta text-muted">
            Chosen from the media library. Players without one show their squad number instead.
          </p>

          {draft.photo_url ? (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <Image
                src={draft.photo_url}
                alt=""
                width={120}
                height={160}
                className="h-40 w-auto object-cover object-top"
              />
              <button
                type="button"
                onClick={() => set("photo_url", "")}
                className="text-meta font-semibold underline underline-offset-4"
              >
                Remove
              </button>
            </div>
          ) : null}

          <div className="mt-4">
            <MediaPicker
              label={draft.photo_url ? "Choose a different photograph" : "Choose a photograph"}
              onSelect={(asset) => set("photo_url", asset.url)}
            />
          </div>
        </div>
      </section>

      <section className="border-t-4 border-accent-ink pt-6">
        <h2 className="font-display text-xl font-extrabold uppercase">Club records</h2>
        <p className="mt-2 max-w-2xl text-meta text-muted">
          Held for the club&rsquo;s own use and never returned by any public part of the website.
          Only people with permission to see private player data can read this.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date of birth" htmlFor="date_of_birth">
            <input
              id="date_of_birth"
              type="date"
              value={draft.date_of_birth}
              onChange={(event) => set("date_of_birth", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              maxLength={32}
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Next of kin" htmlFor="emergency_contact_name">
            <input
              id="emergency_contact_name"
              maxLength={160}
              value={draft.emergency_contact_name}
              onChange={(event) => set("emergency_contact_name", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Next of kin phone" htmlFor="emergency_contact_phone">
            <input
              id="emergency_contact_phone"
              type="tel"
              maxLength={32}
              value={draft.emergency_contact_phone}
              onChange={(event) => set("emergency_contact_phone", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <Field label="Internal notes" htmlFor="internal_notes" className="mt-6">
          <textarea
            id="internal_notes"
            rows={3}
            value={draft.internal_notes}
            onChange={(event) => set("internal_notes", event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>
      </section>

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
          {busy ? "Saving…" : isNew ? "Add player" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
