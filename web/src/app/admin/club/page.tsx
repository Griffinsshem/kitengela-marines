"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { ClubStaff } from "@/components/admin/ClubStaff";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";

/**
 * The club's own details.
 *
 * Everything here appears on the About page. Fields left blank are left out of
 * the page rather than shown as gaps, so the club can fill this in as it
 * settles on its own wording.
 */

type ClubDraft = {
  name: string;
  short_name: string;
  founded_year: string;
  home_ground: string;
  town: string;
  county: string;
  contact_email: string;
  contact_phone: string;
  summary: string;
  mission: string;
  values_text: string;
  training_times: string;
};

const BLANK: ClubDraft = {
  name: "",
  short_name: "",
  founded_year: "",
  home_ground: "",
  town: "",
  county: "",
  contact_email: "",
  contact_phone: "",
  summary: "",
  mission: "",
  values_text: "",
  training_times: "",
};

export default function AdminClubPage() {
  const { authFetch } = useAuth();
  const [draft, setDraft] = useState<ClubDraft>(BLANK);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/club");
      if (cancelled) return;

      if (response.ok) {
        const body: unknown = await response.json();
        const club = (body as { data?: Record<string, unknown> | null }).data;
        if (club && !cancelled) {
          setDraft({
            name: String(club.name ?? ""),
            short_name: String(club.short_name ?? ""),
            founded_year: club.founded_year ? String(club.founded_year) : "",
            home_ground: String(club.home_ground ?? ""),
            town: String(club.town ?? ""),
            county: String(club.county ?? ""),
            contact_email: String(club.contact_email ?? ""),
            contact_phone: String(club.contact_phone ?? ""),
            summary: String(club.summary ?? ""),
            mission: String(club.mission ?? ""),
            values_text: String(club.values_text ?? ""),
            training_times: String(club.training_times_text ?? ""),
          });
        }
      }
      if (!cancelled) setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  function set(field: keyof ClubDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const optional = (value: string) => (value.trim() === "" ? null : value.trim());

    const response = await authFetch("/admin/club", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        short_name: draft.short_name,
        founded_year: draft.founded_year === "" ? null : Number(draft.founded_year),
        home_ground: optional(draft.home_ground),
        town: optional(draft.town),
        county: optional(draft.county),
        contact_email: optional(draft.contact_email),
        contact_phone: optional(draft.contact_phone),
        summary: optional(draft.summary),
        mission: optional(draft.mission),
        values_text: optional(draft.values_text),
        training_times: optional(draft.training_times),
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
              "The club details could not be saved."),
      );
      return;
    }

    setMessage("Saved. The About page reflects this.");
  }

  if (!loaded) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Club settings</h1>

      <form onSubmit={submit} className="mt-8 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Club details</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Short name" htmlFor="short_name">
            <input
              id="short_name"
              required
              maxLength={60}
              value={draft.short_name}
              onChange={(event) => set("short_name", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Founded" htmlFor="founded_year" hint="Optional. Leave blank if unsure.">
            <input
              id="founded_year"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={draft.founded_year}
              onChange={(event) => set("founded_year", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Home ground" htmlFor="home_ground">
            <input
              id="home_ground"
              maxLength={160}
              value={draft.home_ground}
              onChange={(event) => set("home_ground", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Town" htmlFor="town">
            <input
              id="town"
              maxLength={120}
              value={draft.town}
              onChange={(event) => set("town", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="County" htmlFor="county">
            <input
              id="county"
              maxLength={120}
              value={draft.county}
              onChange={(event) => set("county", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Contact email" htmlFor="contact_email" hint="Shown publicly.">
            <input
              id="contact_email"
              type="email"
              maxLength={254}
              value={draft.contact_email}
              onChange={(event) => set("contact_email", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Contact phone" htmlFor="contact_phone" hint="Shown publicly.">
            <input
              id="contact_phone"
              type="tel"
              maxLength={32}
              value={draft.contact_phone}
              onChange={(event) => set("contact_phone", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Vision" htmlFor="summary" hint="A sentence or two, shown near the top.">
            <textarea
              id="summary"
              rows={3}
              value={draft.summary}
              onChange={(event) => set("summary", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Mission" htmlFor="mission" hint="What the club is for.">
            <textarea
              id="mission"
              rows={3}
              value={draft.mission}
              onChange={(event) => set("mission", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Values" htmlFor="values_text" hint="One per line.">
            <textarea
              id="values_text"
              rows={5}
              value={draft.values_text}
              onChange={(event) => set("values_text", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field
            label="Training times"
            htmlFor="training_times"
            hint="One per line, for example: Monday to Friday, 4:30pm to 6:00pm"
          >
            <textarea
              id="training_times"
              rows={5}
              value={draft.training_times}
              onChange={(event) => set("training_times", event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="mt-4 border border-line px-4 py-3 font-semibold">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-4 border border-accent-ink px-4 py-3 font-semibold">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save club details"}
        </button>
      </form>

      <section className="mt-12">
        <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
          Coaching and club staff
        </h2>
        <div className="mt-6">
          <ClubStaff />
        </div>
      </section>
    </div>
  );
}
