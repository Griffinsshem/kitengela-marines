"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { MediaTabs } from "@/components/admin/MediaTabs";

type Video = {
  id: string;
  slug: string;
  title: string;
  youtube_id: string;
  thumbnail_url: string;
  published_on: string | null;
  is_published: boolean;
};

/**
 * Club video.
 *
 * A YouTube link is pasted and the API keeps only the video id, so whatever
 * shape the link arrives in — watch, youtu.be, shorts — the site ends up
 * framing YouTube and nothing else.
 */
export default function AdminVideosPage() {
  const { authFetch } = useAuth();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/videos?per_page=50");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setVideos((body as { data?: Video[] }).data ?? []);
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

    const response = await authFetch("/admin/videos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        youtube_url: url,
        published_on: publishedOn || null,
        is_published: publish,
      }),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { message: string }[] } })?.error?.details;
      setError(
        details?.length
          ? details.map((d) => d.message).join("; ")
          : ((body as { error?: { message?: string } })?.error?.message ??
              "The video could not be added."),
      );
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Video }).data;
    if (created) setVideos((current) => [created, ...(current ?? [])]);

    setTitle("");
    setUrl("");
    setPublishedOn("");
  }

  async function togglePublished(video: Video) {
    const response = await authFetch(`/admin/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !video.is_published }),
    });
    if (!response.ok) return;

    const body: unknown = await response.json();
    const updated = (body as { data?: Video }).data;
    if (updated) {
      setVideos((current) =>
        (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  }

  async function remove(video: Video) {
    const response = await authFetch(`/admin/videos/${video.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setVideos((current) => (current ?? []).filter((item) => item.id !== video.id));
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Media</h1>
      <div className="mt-6">
        <MediaTabs />
      </div>

      <form onSubmit={add} className="mt-8 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Add a video</h2>
        <p className="mt-2 text-meta text-muted">
          Videos stay on YouTube. Paste the link and the club&rsquo;s page will show it.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
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

          <Field label="YouTube link" htmlFor="url" hint="Any YouTube address for the video.">
            <input
              id="url"
              required
              maxLength={300}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>

          <Field label="Date" htmlFor="published_on" hint="Optional.">
            <input
              id="published_on"
              type="date"
              value={publishedOn}
              onChange={(event) => setPublishedOn(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
            className="size-5"
          />
          Show on the website straight away
        </label>

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
          {busy ? "Adding…" : "Add video"}
        </button>
      </form>

      <div className="mt-10">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Videos could not be loaded just now.
          </p>
        ) : videos === null ? (
          <p className="text-muted">Loading…</p>
        ) : videos.length === 0 ? (
          <div className="border border-line bg-chalk px-6 py-10 text-center">
            <p className="font-display text-xl font-extrabold uppercase">No videos yet</p>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Highlights and interviews added here appear on the club&rsquo;s video page.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <li key={video.id} className="border border-line bg-chalk">
                <div className="relative aspect-video bg-turf">
                  <Image
                    src={video.thumbnail_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="font-display text-lg font-extrabold uppercase leading-tight">
                    {video.title}
                  </p>
                  <p className="mt-1 text-meta text-muted">
                    {video.is_published ? "On the website" : "Hidden"}
                  </p>
                  <div className="mt-3 flex gap-4 text-meta font-semibold">
                    <button
                      type="button"
                      onClick={() => void togglePublished(video)}
                      className="underline underline-offset-4"
                    >
                      {video.is_published ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(video)}
                      className="underline underline-offset-4"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
