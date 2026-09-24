import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Standard page section: one rhythm for the whole site, so sections differ by
 * their content rather than each inventing its own spacing.
 */
export function Section({
  children,
  className,
  tone = "chalk",
}: {
  children: ReactNode;
  className?: string;
  tone?: "chalk" | "turf" | "pitch";
}) {
  const tones = {
    chalk: "bg-chalk text-pitch",
    turf: "bg-turf text-pitch",
    pitch: "bg-pitch text-chalk",
  } as const;

  return (
    <section className={cn(tones[tone], className)}>
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">{children}</div>
    </section>
  );
}

export function SectionHeading({
  label,
  title,
  action,
}: {
  label: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div>
        <p className="text-meta font-semibold text-accent-ink">{label}</p>
        <h2 className="mt-1 font-display text-headline font-extrabold uppercase">{title}</h2>
      </div>
      {action}
    </div>
  );
}
