import Link from "next/link";

import { cn } from "@/lib/cn";

export type FilterOption = { value?: string; label: string };

/**
 * A row of filter links.
 *
 * Links rather than a select: each filter is a real URL a supporter can
 * bookmark or share, and the page works with JavaScript unavailable. The
 * active option is filled as well as marked with aria-current, so it does not
 * depend on colour alone.
 *
 * One scrolling row rather than a wrapping block. Seven categories wrapped
 * into four rows on a phone and pushed the news itself off the screen, which
 * inverts the point of the page: the filter is a way to reach the stories, not
 * the thing a supporter came to read. The row bleeds to both edges so a
 * half-visible chip shows there is more to scroll.
 */
export function FilterLinks({
  options,
  basePath,
  paramName,
  current,
  label,
}: {
  options: FilterOption[];
  basePath: string;
  paramName: string;
  current?: string;
  label: string;
}) {
  if (options.length < 3) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        "edge-fade -mx-5 flex snap-x snap-proximity scroll-px-5 gap-2 overflow-x-auto px-5 pb-1",
        // Once the row fits, it behaves as an ordinary wrapping group again.
        "sm:mx-0 sm:flex-wrap sm:snap-none sm:px-0",
        // The scrollbar is noise on a row of six chips; the overflow still
        // scrolls by touch, by wheel and by keyboard focus.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.label}
            href={option.value ? `${basePath}?${paramName}=${option.value}` : basePath}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 snap-start items-center rounded-control border px-4 font-semibold",
              active ? "border-accent-ink bg-accent-ink text-chalk" : "border-line hover:bg-turf",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
