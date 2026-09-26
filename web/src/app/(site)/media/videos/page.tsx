import type { Metadata } from "next";

import { VideoPlayer } from "@/components/media/VideoPlayer";
import { Pagination } from "@/components/match/Pagination";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getVideos } from "@/lib/api";
import { formatDate } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "Videos",
  description: "Highlights and interviews from Kitengela Marines.",
};

type Search = { searchParams: Promise<{ page?: string }> };

export default async function VideosPage({ searchParams }: Search) {
  const { page } = await searchParams;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;
  const result = await getVideos({ page: pageNumber });

  return (
    <Section>
      <SectionHeading label="Media" title="Videos" />

      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Club videos" />
        ) : result.data.items.length === 0 ? (
          <EmptyState title="Video coming soon">
            Highlights and interviews will be collected here.
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {result.data.items.map((video) => (
                <li key={video.slug}>
                  <VideoPlayer video={video} />
                  <h2 className="mt-3 font-display text-xl font-extrabold uppercase leading-tight">
                    {video.title}
                  </h2>
                  {video.published_on ? (
                    <p className="mt-1 text-meta text-muted">{formatDate(video.published_on)}</p>
                  ) : null}
                  {video.description ? <p className="mt-2 text-muted">{video.description}</p> : null}
                </li>
              ))}
            </ul>
            <Pagination meta={result.data.meta} basePath="/media/videos" />
          </>
        )}
      </div>
    </Section>
  );
}
