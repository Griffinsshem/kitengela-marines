import type { ReactNode } from "react";

/**
 * What a section shows when it has nothing to show.
 *
 * Two cases, deliberately worded differently. "Empty" means the club has not
 * entered this yet, which is true and worth saying plainly. "Unavailable"
 * means the request failed, and saying "no fixtures have been announced"
 * there would state something false on the club's official site.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border border-line bg-turf px-6 py-10 text-center sm:px-10 sm:py-14">
      <p className="font-display text-xl font-extrabold uppercase tracking-wide">{title}</p>
      {children ? <p className="mx-auto mt-3 max-w-md text-muted">{children}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function UnavailableState({ what }: { what: string }) {
  return (
    <EmptyState title="Temporarily unavailable">
      {what} could not be loaded just now. Please try again shortly.
    </EmptyState>
  );
}
