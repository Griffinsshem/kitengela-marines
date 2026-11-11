import type { ReactNode } from "react";

/**
 * Confirmation that a form went through: a tick that draws itself, then the
 * message. The drawing is the acknowledgement. On a slow connection it makes
 * plain that something happened, where a block of text alone can be missed.
 *
 * The tick is decorative; the heading carries the meaning, and the container
 * is a status region so the result is announced.
 */
export function SuccessTick({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="border border-accent-ink bg-chalk px-6 py-8">
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="success-tick size-12 text-accent-ink"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="24" r="21" pathLength={100} />
        <path d="M15 24.5l6 6 12-13" pathLength={100} />
      </svg>
      <div className="success-message mt-4">
        <p className="font-display text-xl font-extrabold uppercase">{title}</p>
        <div className="mt-3 text-muted">{children}</div>
      </div>
    </div>
  );
}
