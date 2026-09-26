"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { MediaAsset } from "@/lib/schemas";

/**
 * A gallery, with each photograph openable at full size.
 *
 * The enlarged view is a native dialog, so the browser handles focus, Escape
 * and the backdrop. Left and right arrows move between photographs, which is
 * what anyone who has used a photo viewer will try first.
 *
 * The grid is the real content: with JavaScript unavailable the thumbnails
 * still render and still carry their captions, and only the enlargement is
 * lost.
 */
export function Lightbox({ photos }: { photos: MediaAsset[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);

  const move = useCallback(
    (step: 1 | -1) => {
      setIndex((current) => {
        if (current === null) return null;
        const next = current + step;
        if (next < 0) return photos.length - 1;
        if (next >= photos.length) return 0;
        return next;
      });
    },
    [photos.length],
  );

  useEffect(() => {
    if (index === null) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, move]);

  function open(position: number) {
    setIndex(position);
    dialogRef.current?.showModal();
  }

  function close() {
    setIndex(null);
    dialogRef.current?.close();
  }

  const current = index === null ? null : photos[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, position) => (
          <li key={photo.url}>
            <button
              type="button"
              onClick={() => open(position)}
              className="group block w-full text-left"
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-turf">
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </span>
              {photo.caption ? (
                <span className="mt-2 block text-meta text-muted">{photo.caption}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setIndex(null)}
        className="max-h-[92dvh] w-full max-w-5xl bg-transparent p-0 backdrop:bg-pitch/90"
      >
        {current ? (
          <figure className="bg-pitch text-chalk">
            <div className="relative aspect-[3/2] w-full">
              <Image
                src={current.url}
                alt={current.alt}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>

            <figcaption className="flex flex-wrap items-center justify-between gap-4 border-t border-chalk/20 px-5 py-4">
              <span className="text-meta">
                {current.caption ?? current.alt}
                <span className="ml-3 text-chalk/60">
                  {(index ?? 0) + 1} of {photos.length}
                </span>
              </span>

              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="rounded-control border border-chalk/30 px-4 py-2 font-semibold"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="rounded-control border border-chalk/30 px-4 py-2 font-semibold"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-control bg-highlight px-4 py-2 font-semibold text-on-highlight"
                >
                  Close
                </button>
              </span>
            </figcaption>
          </figure>
        ) : null}
      </dialog>
    </>
  );
}
