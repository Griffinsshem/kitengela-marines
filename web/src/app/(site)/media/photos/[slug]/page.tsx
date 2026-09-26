import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Lightbox } from "@/components/media/Lightbox";
import { UnavailableState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getGallery } from "@/lib/api";
import { formatDate } from "@/lib/datetime";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await getGallery(slug);
  if (!result.ok) return { title: "Photos" };

  const gallery = result.data;
  return {
    title: gallery.title,
    description: gallery.description ?? `Photographs from ${gallery.title}.`,
    openGraph: gallery.cover
      ? { images: [{ url: gallery.cover.url, alt: gallery.cover.alt }] }
      : undefined,
  };
}

export default async function GalleryPage({ params }: Params) {
  const { slug } = await params;
  const result = await getGallery(slug);

  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return (
      <Section>
        <UnavailableState what="This gallery" />
      </Section>
    );
  }

  const gallery = result.data;
  const accent = gallery.team ? toTeamAccentKey(gallery.team.accent_key) : "club";
  const date = formatDate(gallery.event_date);

  return (
    <div data-team={accent}>
      <header className="bg-pitch text-chalk">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
            {gallery.team ? gallery.team.name : "Club photography"}
          </p>
          <h1 className="mt-3 font-display text-headline font-black uppercase leading-tight">
            {gallery.title}
          </h1>
          {gallery.description ? (
            <p className="mt-4 max-w-2xl text-lg text-chalk/85">{gallery.description}</p>
          ) : null}
          <p className="mt-4 text-meta text-chalk/60">
            {gallery.photos.length} {gallery.photos.length === 1 ? "photograph" : "photographs"}
            {date ? ` — ${date}` : ""}
          </p>
        </div>
      </header>

      <Section>
        <Lightbox photos={gallery.photos} />

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-meta">
          {gallery.fixture ? (
            <Link
              href={`/matches/${gallery.fixture.slug}`}
              className="font-semibold text-accent-ink underline-offset-4 hover:underline"
            >
              Match details
            </Link>
          ) : null}
          <Link href="/media/photos" className="font-semibold underline-offset-4 hover:underline">
            All galleries
          </Link>
        </footer>
      </Section>
    </div>
  );
}
