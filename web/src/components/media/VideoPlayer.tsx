"use client";

import Image from "next/image";
import { useState } from "react";

import type { Video } from "@/lib/schemas";

/**
 * A video, played only when a supporter asks for it.
 *
 * Until then this is a thumbnail and a button: no YouTube iframe, no YouTube
 * script, no request to YouTube at all. A page of embedded players would load
 * several hundred kilobytes and announce every visitor to Google before anyone
 * pressed play, which matters most to supporters on metered mobile data.
 */
export function VideoPlayer({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden bg-pitch">
      {playing ? (
        <iframe
          src={`${video.embed_url}?autoplay=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full"
        >
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 grid place-items-center bg-pitch/30">
            <span className="rounded-control bg-highlight px-5 py-3 font-semibold text-on-highlight">
              Play video
            </span>
          </span>
          <span className="sr-only">Play {video.title}</span>
        </button>
      )}
    </div>
  );
}
