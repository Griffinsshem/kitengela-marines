import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { RisingWords } from "@/components/ui/RisingWords";
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
 *
 * It enters like a broadcast title card: the kit bar draws in, the name rises
 * word by word, the supporting lines and the next-match panel follow, and a
 * photograph settles from a slight zoom. All of it is CSS that runs as the
 * HTML paints, finishes inside a second, and is absent for anyone who has
 * asked their system for less motion.
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
            className="entrance-photo -z-10 object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-t from-pitch via-pitch/85 to-pitch/60"
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
          <div aria-hidden="true" className="entrance-bar flex h-1.5 w-40 overflow-hidden">
            <span className="flex-1 bg-men-green" />
            <span className="flex-1 bg-men-yellow" />
            <span className="flex-1 bg-men-gold" />
          </div>

          <h1 className="mt-6 font-display text-display font-black uppercase">
            <RisingWords text={name} />
          </h1>

          {place ? (
            <p
              className="entrance-fade mt-4 text-lg font-semibold text-accent-glow"
              style={step(0)}
            >
              {place}
            </p>
          ) : null}
          {summary ? (
            <p className="entrance-fade mt-4 max-w-xl text-lg text-chalk/85" style={step(1)}>
              {summary}
            </p>
          ) : null}

          <div className="entrance-fade mt-8 flex flex-wrap gap-3" style={step(2)}>
            <ButtonLink href="/fixtures" variant="highlight" arrow>
              Fixtures and results
            </ButtonLink>
            <ButtonLink href="/club" variant="outline">
              About the club
            </ButtonLink>
          </div>
        </div>

        {children ? (
          <div className="entrance-fade lg:pb-2" style={step(3)}>
            {children}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Position in the entrance sequence, read by `.entrance-fade` in globals.css. */
function step(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
