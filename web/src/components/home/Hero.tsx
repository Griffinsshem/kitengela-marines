import Image from "next/image";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Club, MediaAsset } from "@/lib/schemas";

/**
 * The hero.
 *
 * Built to carry a photograph, and honest without one. Until the club supplies
 * match photography the composition is typographic: the club's name at poster
 * scale over the pitch colour, above a bar in the three kit colours. No stock
 * football image stands in for the real thing.
 *
 * When `image` is supplied it fills the band behind the type, with a gradient
 * that keeps the headline legible over any photograph.
 */
export function Hero({
  club,
  image,
  children,
}: {
  club: Club | null;
  image?: MediaAsset | null;
  children?: ReactNode;
}) {
  const name = club?.name ?? "Kitengela Marines";
  const place = [club?.town, club?.county].filter(Boolean).join(", ");
  const summary = club?.summary;

  return (
    <section className="relative isolate overflow-hidden bg-pitch text-chalk">
      {image ? (
        <>
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-pitch via-pitch/80 to-pitch/40"
          />
        </>
      ) : null}

      <div className={cn(
          "mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-end",
          // A photograph earns the extra height. Without one the band
          // should not reserve a screenful of empty colour.
          image ? "py-16 sm:py-28" : "py-12 sm:py-16",
        )}>
        <div>
          {/* The three kit colours, in the order they appear on the shirts. */}
          <div aria-hidden="true" className="flex h-1.5 w-40 overflow-hidden">
            <span className="flex-1 bg-men-green" />
            <span className="flex-1 bg-men-yellow" />
            <span className="flex-1 bg-men-gold" />
          </div>

          <h1 className="mt-6 font-display text-display font-black uppercase">{name}</h1>

          {place ? <p className="mt-4 text-lg font-semibold text-accent-glow">{place}</p> : null}
          {summary ? <p className="mt-4 max-w-xl text-lg text-chalk/85">{summary}</p> : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/fixtures" variant="highlight">
              Fixtures and results
            </ButtonLink>
            <ButtonLink href="/club" variant="outline">
              About the club
            </ButtonLink>
          </div>
        </div>

        {children ? <div className="lg:pb-2">{children}</div> : null}
      </div>
    </section>
  );
}
