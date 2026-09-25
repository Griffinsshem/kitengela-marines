"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { GalleryPhotos, type GalleryPhoto } from "@/components/admin/GalleryPhotos";

type GalleryPayload = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string | null;
  is_published: boolean;
  team_id: string | null;
  photos: GalleryPhoto[];
};

type Team = { id: string; name: string };

export default function EditGalleryPage() {
  const params = useParams<{ id: string }>();
  const { authFetch } = useAuth();

  const [gallery, setGallery] = useState<GalleryPayload | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [teamId, setTeamId] = useState("");
  const [published, setPublished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [galleryResponse, teamResponse] = await Promise.all([
        authFetch(`/admin/galleries/${params.id}`),
        authFetch("/teams"),
      ]);
      if (cancelled) return;

      if (teamResponse.ok) {
        const body: unknown = await teamResponse.json();
        if (!cancelled) setTeams((body as { data?: Team[] }).data ?? []);
      }

      if (!galleryResponse.ok) {
        setFailed(true);
        return;
      }

      const body: unknown = await galleryResponse.json();
      const record = (body as { data?: GalleryPayload }).data;
      if (cancelled) return;

      if (!record) {
        setFailed(true);
        return;
      }

      setGallery(record);
      setTitle(record.title);
      setDescription(record.description ?? "");
      setEventDate(record.event_date ?? "");
      setTeamId(record.team_id ?? "");
      setPublished(record.is_published);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, params.id]);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const response = await authFetch(`/admin/galleries/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() || null,
        event_date: eventDate || null,
        team_id: teamId || null,
        is_published: published,
      }),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setMessage(
        (body as { error?: { message?: string } })?.error?.message ??
          "The gallery could not be saved.",
      );
      return;
    }

    setMessage(published ? "Saved. The gallery is on the website." : "Saved as unpublished.");
  }

  if (failed) {
    return (
      <p className="border border-line bg-chalk px-4 py-3">This gallery could not be loaded.</p>
    );
  }

  if (!gallery) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">{gallery.title}</h1>
        <div className="flex gap-4 text-meta">
          <Link href="/admin/media/galleries" className="underline-offset-4 hover:underline">
            All galleries
          </Link>
          {gallery.is_published ? (
            <Link
              href={`/media/photos/${gallery.slug}`}
              className="font-semibold text-accent-ink underline-offset-4 hover:underline"
            >
              View on site
            </Link>
          ) : null}
        </div>
      </div>

      <form onSubmit={saveDetails} className="mt-8 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Details</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title">
            <input
              id="title"
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Date" htmlFor="event_date" hint="Optional.">
            <input
              id="event_date"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Team" htmlFor="team" hint="Optional. Sets the colours the gallery carries.">
            <select
              id="team"
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

          <Field label="Description" htmlFor="description" hint="Optional.">
            <textarea
              id="description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            className="size-5"
          />
          Published on the website
        </label>

        {message ? (
          <p role="status" className="mt-4 border border-line px-4 py-3 font-semibold">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-control border border-line px-5 py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save details"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
          Photographs
        </h2>
        <div className="mt-6">
          <GalleryPhotos galleryId={gallery.id} initial={gallery.photos} />
        </div>
      </section>
    </div>
  );
}
