"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { MediaTabs } from "@/components/admin/MediaTabs";
import { formatDate } from "@/lib/datetime";

type Gallery = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  photo_count: number;
  is_published: boolean;
};

export default function AdminGalleriesPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/galleries?per_page=50");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setGalleries((body as { data?: Gallery[] }).data ?? []);
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

    const response = await authFetch("/admin/galleries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, event_date: eventDate || null }),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setError(
        (body as { error?: { message?: string } })?.error?.message ??
          "The gallery could not be created.",
      );
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Gallery }).data;
    if (created) router.push(`/admin/media/galleries/${created.id}`);
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Media</h1>
      <div className="mt-6">
        <MediaTabs />
      </div>

      <form onSubmit={create} className="mt-8 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Start a gallery</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" hint="For example, the match it is from.">
            <input
              id="title"
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
          <Field
            label="Date"
            htmlFor="event_date"
            hint="Optional. When the photographs were taken."
          >
            <input
              id="event_date"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className={CONTROL_CLASSES}
            />
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
          className="mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create and add photographs"}
        </button>
      </form>

      <div className="mt-10">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Galleries could not be loaded just now.
          </p>
        ) : galleries === null ? (
          <p className="text-muted">Loading…</p>
        ) : galleries.length === 0 ? (
          <div className="border border-line bg-chalk px-6 py-10 text-center">
            <p className="font-display text-xl font-extrabold uppercase">No galleries yet</p>
            <p className="mx-auto mt-3 max-w-md text-muted">
              A gallery collects photographs from one match or occasion.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {galleries.map((gallery) => (
              <li key={gallery.id}>
                <Link
                  href={`/admin/media/galleries/${gallery.id}`}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4 hover:bg-turf"
                >
                  <span className="font-display text-lg font-extrabold uppercase leading-tight">
                    {gallery.title}
                  </span>
                  <span className="text-meta text-muted">
                    {gallery.photo_count}{" "}
                    {gallery.photo_count === 1 ? "photograph" : "photographs"}
                  </span>
                  {gallery.event_date ? (
                    <span className="text-meta text-muted">{formatDate(gallery.event_date)}</span>
                  ) : null}
                  <span className="border border-line px-2 py-0.5 text-meta font-semibold">
                    {gallery.is_published ? "Published" : "Not published"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
