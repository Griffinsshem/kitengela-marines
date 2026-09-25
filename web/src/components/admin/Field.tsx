import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export const CONTROL_CLASSES =
  "mt-2 w-full rounded-control border border-line bg-chalk px-3 py-2.5 text-pitch";

/** A labelled control. The label is always present, never a placeholder. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <label htmlFor={htmlFor} className="block text-meta font-semibold">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-meta text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
