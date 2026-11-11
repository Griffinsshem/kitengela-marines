import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import type { Player } from "@/lib/schemas";

const STATUS_LABEL: Record<string, string> = {
  injured: "Injured",
  suspended: "Suspended",
};

/**
 * A player, as a football media card rather than a generic website card.
 *
 * Photographs are cropped to one portrait ratio so a squad page reads as a
 * set. Players without a photograph get their squad number at display size
 * instead of a grey silhouette, which looks deliberate and avoids implying the
 * club failed to supply something.
 *
 * The photograph carries a view-transition name shared with the profile page,
 * so following the card morphs the picture into the profile's header instead
 * of swapping one image for another.
 */
export function PlayerCard({ player }: { player: Player }) {
  const status = STATUS_LABEL[player.status];

  return (
    <article className="group">
      <Link href={`/teams/${player.team.slug}/players/${player.slug}`} className="block">
        <div className="card-bar relative aspect-[3/4] overflow-hidden bg-pitch">
          {player.photo_url ? (
            <ViewTransition name={playerPhotoTransition(player.slug)} share="morph" default="none">
              <Image
                src={player.photo_url}
                alt={player.display_name}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover object-top transition duration-500 group-hover:scale-[1.03]"
              />
            </ViewTransition>
          ) : (
            <p className="flex h-full items-center justify-center font-display text-score font-black text-accent-glow">
              {player.squad_number ?? ""}
            </p>
          )}

          {player.squad_number !== null && player.photo_url ? (
            <p className="absolute left-0 top-0 bg-accent px-3 py-1 font-display text-xl font-black tabular-nums text-chalk">
              {player.squad_number}
            </p>
          ) : null}
        </div>

        <h3 className="mt-3 font-display text-xl font-extrabold uppercase leading-tight underline-offset-4 group-hover:underline">
          {player.display_name}
        </h3>
        <p className="text-meta capitalize text-muted">{player.position}</p>
        {status ? (
          <p className="mt-1 inline-block border border-line px-2 py-0.5 text-meta font-semibold">
            {status}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

/** Shared by the card and the profile page, so the photograph can morph. */
export function playerPhotoTransition(slug: string): string {
  return `player-photo-${slug}`;
}
