import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { cn } from "@/lib/cn";

type Variant = "highlight" | "accent" | "outline";

const VARIANTS: Record<Variant, string> = {
  // The club's brightest colour, reserved for the single most important
  // action in a section.
  highlight: "bg-highlight text-on-highlight hover:brightness-95",
  accent: "bg-accent-ink text-chalk hover:brightness-110",
  outline: "border border-current hover:bg-current/10",
};

/**
 * A link styled as a button.
 *
 * Presses compress it very slightly, so a tap registers immediately even when
 * the page it leads to is slow to arrive, which on a sleeping API it may be.
 * `arrow` adds a trailing arrow that nudges forward on hover and focus, for
 * links that lead on to a fuller list ("All results", "Full table").
 */
export function ButtonLink({
  href,
  children,
  variant = "accent",
  arrow = false,
  className,
}: {
  href: string;
  children: string;
  variant?: Variant;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // 44px minimum height for touch targets.
        "group/button inline-flex min-h-11 items-center gap-2 rounded-control px-5 py-2.5 font-semibold",
        "transition duration-150 ease-out active:scale-[0.98]",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
      {arrow ? (
        <ArrowRight
          aria-hidden="true"
          weight="bold"
          className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover/button:translate-x-[3px] group-focus-visible/button:translate-x-[3px]"
        />
      ) : null}
    </Link>
  );
}
