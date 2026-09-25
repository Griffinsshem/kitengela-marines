"use client";

import Image from "next/image";
import { useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { MediaPicker } from "@/components/admin/MediaPicker";

/**
 * The photographs in a gallery, and their order.
 *
 * The API replaces the whole list in one request, so this holds the working
 * order locally and sends it when the editor is happy. Order is the content of
 * a gallery: adding, removing, reordering and re-captioning are one save, and
 * there is no moment when a published gallery is half-updated.
 *
 * Moving is done with buttons rather than dragging. Dragging is quicker with a
 * mouse and impossible with a keyboard, and these buttons work with both.
 */

export type GalleryPhoto = {
  asset_id: string;
  url: string;
  alt: string;
  caption: string | null;
};

export function GalleryPhotos({
  galleryId,
  initial,
}: {
  galleryId: string;
  initial: GalleryPhoto[];
}) {
  const { authFetch } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;

    setPhotos((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMessage(null);

    const response = await authFetch(`/admin/galleries/${galleryId}/photos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photos: photos.map((photo) => ({
          asset_id: photo.asset_id,
          caption: photo.caption?.trim() || null,
        })),
      }),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      setMessage(
        (body as { error?: { message?: string } })?.error?.message ??
          "The photographs could not be saved.",
      );
      return;
    }

    setMessage("Photographs saved.");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {photos.length} {photos.length === 1 ? "photograph" : "photographs"}
        </p>
        <MediaPicker
          label="Add a photograph"
          onSelect={(asset) =>
            setPhotos((current) =>
              // Already in the gallery: the API allows each photo once.
              current.some((photo) => photo.asset_id === asset.id)
                ? current
                : [
                    ...current,
                    { asset_id: asset.id, url: asset.url, alt: asset.alt, caption: null },
                  ],
            )
          }
        />
      </div>

      {photos.length === 0 ? (
        <p className="mt-6 border border-line bg-chalk px-4 py-6 text-center text-muted">
          No photographs in this gallery yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {photos.map((photo, index) => (
            <li
              key={photo.asset_id}
              className="flex flex-wrap items-center gap-4 border border-line bg-chalk p-3"
            >
              <span className="w-8 shrink-0 text-center font-display text-lg font-black tabular-nums text-muted">
                {index + 1}
              </span>

              <Image
                src={photo.url}
                alt={photo.alt}
                width={120}
                height={90}
                className="h-16 w-auto object-cover"
              />

              <input
                aria-label={`Caption for ${photo.alt}`}
                placeholder="Caption (optional)"
                maxLength={500}
                value={photo.caption ?? ""}
                onChange={(event) =>
                  setPhotos((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, caption: event.target.value } : item,
                    ),
                  )
                }
                className="min-w-0 flex-1 rounded-control border border-line px-3 py-2"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Move ${photo.alt} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-control border border-line px-3 py-2 font-semibold disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${photo.alt} later`}
                  disabled={index === photos.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-control border border-line px-3 py-2 font-semibold disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((current) => current.filter((_, position) => position !== index))
                  }
                  className="rounded-control border border-line px-3 py-2 text-meta font-semibold"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {message ? (
        <p role="status" className="mt-4 border border-line bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-6 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save photographs and order"}
      </button>
    </div>
  );
}
