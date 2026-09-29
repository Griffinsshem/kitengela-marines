import { Section } from "@/components/ui/Section";
import { LoadingAnnouncement, Skeleton, SkeletonText } from "@/components/ui/Skeleton";

/**
 * The default shape of a page while it loads.
 *
 * Individual sections supply their own where the shape differs enough to
 * matter; this is a heading, some text and a few blocks, which is most pages.
 */
export default function Loading() {
  return (
    <Section>
      <LoadingAnnouncement what="the page" />
      <div className="border-b border-line pb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-64" />
      </div>
      <div className="mt-8 space-y-6">
        <SkeletonText lines={2} className="max-w-2xl" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </div>
    </Section>
  );
}
