"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { MediaTabs } from "@/components/admin/MediaTabs";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { type MediaAsset, fileSize } from "@/components/admin/media";
import { formatDate } from "@/lib/datetime";

/**
 * The media library.
 *
 * Every photograph the club has uploaded, newest first, with the description
 * it carries. Deleting is refused by the API while a gallery, a gallery cover
 * or an article still uses the picture, and the refusal says which — so this
 * page shows that message rather than duplicating the check and risking a
 * different answer.
 */
export default function AdminMediaPage() {
  const { authFetch } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/media/assets?per_page=60");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setAssets((body as { data?: MediaAsset[] }).data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function saveAlt(asset: MediaAsset) {
    const response = await authFetch(`/admin/media/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: altDraft }),
    });

    if (!response.ok) {
      setMessage("The description could not be saved.");
      return;
    }

    const body: unknown = await response.json();
    const updated = (body as { data?: MediaAsset }).data;
    if (updated) {
      setAssets((current) =>
        (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    }
    setEditing(null);
  }

  async function remove(asset: MediaAsset) {
    setMessage(null);
    const response = await authFetch(`/admin/media/assets/${asset.id}`, { method: "DELETE" });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      // A 409 names what still uses the photograph.
      setMessage(
        (body as { error?: { message?: string } })?.error?.message ??
          "The photograph could not be deleted.",
      );
      return;
    }

    setAssets((current) => (current ?? []).filter((item) => item.id !== asset.id));
    setMessage("Photograph deleted.");
  }

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Media</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Photographs are resized when they are uploaded, and the location data phones record is
        removed before anything is stored.
      </p>

      <div className="mt-6">
        <MediaTabs />
      </div>

      <div className="mt-8">
        <MediaUpload onUploaded={(asset) => setAssets((current) => [asset, ...(current ?? [])])} />
      </div>

      {message ? (
        <p role="status" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}

      <div className="mt-10">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            The media library could not be loaded just now.
          </p>
        ) : assets === null ? (
          <p className="text-muted">Loading…</p>
        ) : assets.length === 0 ? (
          <div className="border border-line bg-chalk px-6 py-10 text-center">
            <p className="font-display text-xl font-extrabold uppercase">Nothing uploaded yet</p>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Photographs added here can be used in articles, galleries and player profiles.
            </p>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <li key={asset.id} className="border border-line bg-chalk">
                <div className="relative aspect-[4/3] bg-turf">
                  <Image
                    src={asset.url}
                    alt={asset.alt}
                    fill
                    sizes="(min-width: 1024px) 30vw, 50vw"
                    className="object-cover"
                  />
                </div>

                <div className="p-4">
                  {editing === asset.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        aria-label="Description"
                        value={altDraft}
                        maxLength={250}
                        onChange={(event) => setAltDraft(event.target.value)}
                        className="min-w-0 flex-1 rounded-control border border-line px-2 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => void saveAlt(asset)}
                        className="rounded-control border border-line px-3 py-1.5 font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="font-semibold">{asset.alt}</p>
                  )}

                  <p className="mt-2 text-meta text-muted">
                    {asset.width}×{asset.height}, {fileSize(asset.byte_size)}
                  </p>
                  <p className="text-meta text-muted">{formatDate(asset.created_at)}</p>

                  <div className="mt-3 flex gap-4 text-meta font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(asset.id);
                        setAltDraft(asset.alt);
                      }}
                      className="underline underline-offset-4"
                    >
                      Edit description
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(asset)}
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
