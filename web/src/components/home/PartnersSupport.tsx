import Image from "next/image";
import type { CSSProperties } from "react";

import { ButtonLink } from "@/components/ui/Button";
import type { ApiResult } from "@/lib/api";
import type { Sponsor } from "@/lib/schemas";

/**
 * Partners and supporting the club, side by side.
 *
 * The club has no sponsors. The brief forbids inventing any, and a row of
 * placeholder logos would be both dishonest and worse at attracting a real
 * partner than saying plainly that the space is open.
 *
 * Once there are enough partners to fill a row twice over, their logos glide
 * slowly across instead of sitting in a wrapped grid. Fewer than that and a
 * moving strip visibly repeats itself, so a short list stays still.
 */

/** Below this, a marquee would show the same few logos chasing each other. */
const MARQUEE_MINIMUM = 5;
export function PartnersSupport({ result }: { result: ApiResult<Sponsor[]> }) {
  const sponsors = result.ok ? result.data : [];

  return (
    <section className="bg-pitch text-chalk">
      <div className="mx-auto grid max-w-7xl gap-px bg-chalk/20 lg:grid-cols-2">
        <div className="bg-pitch px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-meta font-semibold text-accent-glow">Partners</p>
          {sponsors.length > 0 ? (
            <>
              <h2 className="mt-1 font-display text-headline font-extrabold uppercase">
                Our partners
              </h2>
              <div className="mt-8">
                {sponsors.length >= MARQUEE_MINIMUM ? (
                  <SponsorMarquee sponsors={sponsors} />
                ) : (
                  <ul className="flex flex-wrap items-center gap-8">
                    {sponsors.map((sponsor) => (
                      <li key={sponsor.slug}>
                        <SponsorMark sponsor={sponsor} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-8">
                <ButtonLink href="/partners" variant="outline">
                  Partner with us
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-1 font-display text-headline font-extrabold uppercase">
                Build with us
              </h2>
              <p className="mt-4 max-w-md text-chalk/85">
                Kitengela Marines is open to businesses and organisations who want to back
                football in Kitengela. Shirt and match sponsorship, training kit, equipment and
                community partnerships are all available.
              </p>
              <div className="mt-8">
                <ButtonLink href="/partners" variant="highlight">
                  Become a partner
                </ButtonLink>
              </div>
            </>
          )}
        </div>

        <div className="bg-pitch px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-meta font-semibold text-accent-glow">Support</p>
          <h2 className="mt-1 font-display text-headline font-extrabold uppercase">
            Back the Marines
          </h2>
          <p className="mt-4 max-w-md text-chalk/85">
            Match-day logistics, training equipment, kit and transport are what keep both teams on
            the pitch. Supporters who want to help can find the club&rsquo;s details on the
            support page.
          </p>
          <div className="mt-8">
            <ButtonLink href="/support" variant="outline">
              Ways to support
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function SponsorMark({ sponsor }: { sponsor: Sponsor }) {
  return sponsor.logo ? (
    <Image
      src={sponsor.logo.url}
      alt={sponsor.logo.alt}
      width={160}
      height={80}
      className="h-12 w-auto object-contain"
    />
  ) : (
    <span className="whitespace-nowrap font-display text-xl font-extrabold uppercase">
      {sponsor.name}
    </span>
  );
}

/**
 * Two identical copies side by side, the track sliding exactly one copy's
 * width and looping, so the join never shows. The second copy is hidden from
 * assistive technology and removed entirely under reduced motion, which
 * leaves one ordinary list. Hovering pauses it, so a logo can be read.
 */
function SponsorMarquee({ sponsors }: { sponsors: Sponsor[] }) {
  // A steady reading pace however many partners there are.
  const style = { "--marquee-duration": `${sponsors.length * 6}s` } as CSSProperties;

  return (
    <div className="marquee" style={style}>
      <div className="marquee-track">
        {[false, true].map((copy) => (
          <ul
            key={String(copy)}
            aria-hidden={copy || undefined}
            className={copy ? "marquee-copy flex items-center gap-12 pr-12" : "flex items-center gap-12 pr-12"}
          >
            {sponsors.map((sponsor) => (
              <li key={sponsor.slug} className="shrink-0">
                <SponsorMark sponsor={sponsor} />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
