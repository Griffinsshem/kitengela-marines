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

export function ButtonLink({
  href,
  children,
  variant = "accent",
  className,
}: {
  href: string;
  children: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // 44px minimum height for touch targets.
        "inline-flex min-h-11 items-center rounded-control px-5 py-2.5 font-semibold transition",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
