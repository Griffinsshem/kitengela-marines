"use client";

import { useEffect } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

/**
 * Shown when a page fails in a way nothing anticipated.
 *
 * Deliberately says nothing about what went wrong. A supporter cannot act on a
 * stack trace, and an error message is a gift to anyone probing the site. The
 * details go to the browser console, where the club's developer can find them.
 *
 * The retry button is the one thing worth offering: most failures here are a
 * sleeping API, and trying again a few seconds later usually works.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <div aria-hidden="true" className="mx-auto flex h-1.5 w-28 overflow-hidden">
          <span className="flex-1 bg-men-green" />
          <span className="flex-1 bg-men-yellow" />
          <span className="flex-1 bg-men-gold" />
        </div>

        <h1 className="mt-6 font-display text-headline font-black uppercase">
          Something went wrong
        </h1>
        <p className="mt-4 text-lg text-muted">
          This page could not be shown just now. It is usually temporary.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-control bg-highlight px-6 py-3 font-semibold text-on-highlight"
          >
            Try again
          </button>
          <ButtonLink href="/" variant="outline">
            Go to the home page
          </ButtonLink>
        </div>

        {error.digest ? (
          // The one detail worth surfacing: it identifies this failure in the
          // server logs without revealing anything about it.
          <p className="mt-8 text-meta text-muted">Reference: {error.digest}</p>
        ) : null}
      </div>
    </Section>
  );
}
