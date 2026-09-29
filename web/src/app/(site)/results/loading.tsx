import { Section } from "@/components/ui/Section";
import { LoadingAnnouncement, Skeleton } from "@/components/ui/Skeleton";

/** Match cards are tall and stacked, so the placeholder is too. */
export default function Loading() {
  return (
    <Section>
      <LoadingAnnouncement what="results" />
      <div className="border-b border-line pb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-48" />
      </div>

      <div className="mt-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-28 rounded-control" />
        ))}
      </div>

      <Skeleton className="mt-10 h-5 w-40" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44" />
        ))}
      </div>
    </Section>
  );
}
