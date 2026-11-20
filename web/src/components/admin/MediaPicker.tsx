"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { LoadMore } from "@/components/admin/LoadMore";
import { usePagedList } from "@/components/admin/usePagedList";
import type { MediaAsset } from "@/components/admin/media";

/**
 * Choosing a photograph that has already been uploaded.
 *
 * A native dialog, so the browser handles focus trapping, Escape and the
 * backdrop rather than this component reimplementing them badly.
 *
 * Only pictures already in the library can be chosen. Pasting an arbitrary URL
 * would hotlink someone else's server, would be blocked by the site's own
 * content policy, and would arrive without the alt text the library stores
 * beside every image.
 */
export function MediaPicker({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (asset: MediaAsset) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Loaded the first time the dialog opens, not on every form that offers it.
  const [opened, setOpened] = useState(false);
  const {
    rows: assets,
    failed,
    total,
    hasMore,
    loadMore,
    loadingMore,
    moreFailed,
  } = usePagedList<MediaAsset>("/admin/media/assets", 60, opened);

  function show() {
    setOpened(true);
    dialogRef.current?.showModal();
  }

  function hide() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="rounded-control border border-line bg-chalk px-4 py-2 font-semibold"
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-4xl border border-line bg-chalk p-0 backdrop:bg-pitch/70"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-extrabold uppercase">Choose a photograph</h2>
          <button type="button" onClick={hide} className="font-semibold underline-offset-4">
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {failed ? (
            <p className="text-muted">The library could not be loaded just now.</p>
          ) : assets === null ? (
            <p className="text-muted">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-muted">
              No photographs have been uploaded yet. Add some in the media library first.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      hide();
                    }}
                    className="group block w-full text-left"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-turf">
                      <Image
                        src={asset.url}
                        alt={asset.alt}
                        fill
                        sizes="(min-width: 1024px) 20vw, 40vw"
                        className="object-cover transition group-hover:scale-105"
                      />
                    </span>
                    <span className="mt-2 block text-meta font-semibold">{asset.alt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {assets && assets.length > 0 ? (
            <LoadMore
              shown={assets.length}
              total={total}
              hasMore={hasMore}
              loading={loadingMore}
              failed={moreFailed}
              onLoadMore={() => void loadMore()}
              noun="photos"
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
