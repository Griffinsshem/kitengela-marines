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
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.label}
            href={option.value ? `${basePath}?${paramName}=${option.value}` : basePath}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-control border px-4 font-semibold",
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
