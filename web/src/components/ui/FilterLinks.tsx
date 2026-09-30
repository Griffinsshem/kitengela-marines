import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { cn } from "@/lib/cn";

export type FilterOption = { value?: string; label: string };

/**
 * Filtering a list.
 *
 * Two controls for two situations, because the same one cannot serve both.
 *
 * On a phone, a picker. A scrolling row of chips was tried first and failed
 * the only test that matters: a supporter could not tell the row continued,
 * and so could not reach the categories past the second one. A select shows
 * which filter is active, opens the device's own list, and puts every option
 * one tap away regardless of how many there are.
 *
 * On a wider screen, links. Each filter is a real URL that can be bookmarked
 * or shared, the active one is filled rather than merely coloured, and with
 * room to lay them out flat there is no reason to hide them behind a control.
 *
 * The picker is a plain form with a button, not a select that navigates on
 * change. That works with JavaScript unavailable, and it never moves a
 * supporter to another page because they scrolled past an option while
 * looking.
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

  // The picker submits an empty parameter for "all", so ?category= and no
  // parameter at all mean the same thing and must highlight the same option.
  const selected = current === "" ? undefined : current;

  return (
    <>
      <form action={basePath} method="get" className="flex gap-2 sm:hidden">
        <label htmlFor={`${paramName}-filter`} className="sr-only">
          {label}
        </label>

        <div className="relative flex-1">
          <select
            id={`${paramName}-filter`}
            name={paramName}
            defaultValue={selected ?? ""}
            className="min-h-11 w-full appearance-none rounded-control border border-line bg-chalk px-4 pr-10 font-semibold"
          >
            {options.map((option) => (
              <option key={option.label} value={option.value ?? ""}>
                {option.label}
              </option>
            ))}
          </select>
          <CaretDown
            aria-hidden="true"
            weight="bold"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
          />
        </div>

        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-control bg-highlight px-5 font-semibold text-on-highlight"
        >
          Show
        </button>
      </form>

      <nav aria-label={label} className="hidden flex-wrap gap-2 sm:flex">
        {options.map((option) => {
          const active = option.value === selected;
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
    </>
  );
}
