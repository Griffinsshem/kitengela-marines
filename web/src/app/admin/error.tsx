"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown inside the admin when a page fails unexpectedly.
 *
 * Rendered within the admin layout, so the navigation stays usable: an editor
 * can retry, or move on to another section without signing in again.
 * Anything typed on the failed page is gone by now, so the message says so
 * plainly rather than implying a retry will bring it back.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="max-w-xl border border-line bg-chalk px-6 py-8"
    >
      <h1 className="font-display text-headline font-extrabold uppercase">
        This page stopped working
      </h1>
      <p className="mt-4 text-muted">
        Something unexpected went wrong while showing it. Trying again usually
        fixes it. If you had typed changes that were not saved, they will need
        entering again.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-control border border-line px-5 py-2.5 font-semibold"
        >
          Back to the dashboard
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 text-meta text-muted">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
