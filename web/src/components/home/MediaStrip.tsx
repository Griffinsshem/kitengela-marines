import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/datetime";
import type { ApiResult } from "@/lib/api";
import type { GallerySummary } from "@/lib/schemas";

/**
 * Club photography.
 *
 * An editorial grid rather than a row of identical cards: the most recent
 * gallery is given the space, the rest sit beside it.
 */
export function MediaStrip({ result }: { result: ApiResult<GallerySummary[]> }) {
  const galleries = result.ok ? result.data : [];

  return (
    <Section tone="turf">
      <SectionHeading
        label="Media"
        title="From the sidelines"
        action={
          <ButtonLink href="/media/photos" variant="outline">
            All galleries
          </ButtonLink>
        }
      />
      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Club galleries" />
        ) : galleries.length === 0 ? (
          <EmptyState title="Match photography coming soon">
            Photographs from match days, training and club events will be collected here.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {galleries.map((gallery, index) => (
              <li
                key={gallery.slug}
                className={cn(index === 0 && "sm:col-span-2 sm:row-span-2 lg:col-span-2")}
              >
                <GalleryTile gallery={gallery} large={index === 0} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function GalleryTile({ gallery, large }: { gallery: GallerySummary; large: boolean }) {
  const date = formatDate(gallery.event_date);

  return (
    <Link href={`/media/photos/${gallery.slug}`} className="group block h-full">
      <div className="relative aspect-[4/3] overflow-hidden bg-line">
        {gallery.cover ? (
          <Image
            src={gallery.cover.url}
            alt={gallery.cover.alt}
            fill
            sizes={large ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <p className="mt-3 font-display text-lg font-extrabold uppercase leading-tight underline-offset-4 group-hover:underline">
        {gallery.title}
      </p>
      <p className="mt-1 text-meta text-muted">
        {gallery.photo_count} {gallery.photo_count === 1 ? "photo" : "photos"}
      </p>
      {date ? <p className="text-meta text-muted">{date}</p> : null}
    </Link>
  );
}
