import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Pagination } from "@/components/match/Pagination";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getGalleries } from "@/lib/api";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Photos",
  description: "Match day and training photography from Kitengela Marines.",
};

type Search = { searchParams: Promise<{ page?: string }> };

export default async function PhotosPage({ searchParams }: Search) {
  const { page } = await searchParams;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;
  const result = await getGalleries({ page: pageNumber });

  return (
    <Section>
      <SectionHeading label="Media" title="Photos" />

      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Club galleries" />
        ) : result.data.items.length === 0 ? (
          <EmptyState title="Match photography coming soon">
            Photographs from match days, training and club events will be collected here.
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {result.data.items.map((gallery) => (
                <li key={gallery.slug}>
                  <Link href={`/media/photos/${gallery.slug}`} className="group block">
                    <div className="relative aspect-[4/3] overflow-hidden bg-turf">
                      {gallery.cover ? (
                        <Image
                          src={gallery.cover.url}
                          alt={gallery.cover.alt}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <h2 className="mt-3 font-display text-xl font-extrabold uppercase leading-tight underline-offset-4 group-hover:underline">
                      {gallery.title}
                    </h2>
                    <p className="mt-1 text-meta text-muted">
                      {gallery.photo_count}{" "}
                      {gallery.photo_count === 1 ? "photograph" : "photographs"}
                    </p>
                    {gallery.event_date ? (
                      <p className="text-meta text-muted">{formatDate(gallery.event_date)}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination meta={result.data.meta} basePath="/media/photos" />
          </>
        )}
      </div>
    </Section>
  );
}
