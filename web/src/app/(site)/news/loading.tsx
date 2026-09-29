import { Section } from "@/components/ui/Section";
import { LoadingAnnouncement, Skeleton, SkeletonText } from "@/components/ui/Skeleton";

/** One lead story above a grid, which is how the news page is laid out. */
export default function Loading() {
  return (
    <Section>
      <LoadingAnnouncement what="club news" />
      <div className="border-b border-line pb-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-8 w-56" />
      </div>

      <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-3/4" />
          <SkeletonText lines={2} className="mt-3" />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="aspect-4/3 w-full" />
            <Skeleton className="mt-4 h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-full" />
            <SkeletonText lines={2} className="mt-3" />
          </div>
        ))}
      </div>
    </Section>
  );
}
