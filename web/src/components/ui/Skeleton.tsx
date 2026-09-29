import { cn } from "@/lib/cn";

/**
 * A placeholder for content that has not arrived.
 *
 * Skeletons are shaped like the thing they stand in for, so the page does not
 * jump when the real content replaces them. That matters here more than on
 * most sites: the API sleeps when the club's site is quiet, and the first
 * visitor of the day waits several seconds for it to wake. Without this they
 * would stare at the previous page and wonder whether their tap registered.
 *
 * Hidden from screen readers, which are told the page is loading once, rather
 * than read a wall of meaningless boxes.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse-soft bg-line", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("block space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          // The last line stops short, the way a paragraph does.
          className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </span>
  );
}

/** Announces to assistive technology that something is on its way. */
export function LoadingAnnouncement({ what }: { what: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      Loading {what}.
    </p>
  );
}
