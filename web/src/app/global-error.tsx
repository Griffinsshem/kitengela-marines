"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * The last line of defence: shown when the root layout itself fails, which no
 * other error page can catch because they all render inside it.
 *
 * It replaces the whole document, so it brings its own <html> and <body> and
 * depends on nothing but the stylesheet: no fonts module, no shared
 * components, nothing that might be what broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Site error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center px-6">
        <main className="max-w-xl text-center">
          <h1 className="text-4xl font-black uppercase">Kitengela Marines</h1>
          <p className="mt-6 text-lg">
            The website could not be shown just now. It is usually temporary.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-control bg-highlight px-6 py-3 font-semibold text-on-highlight"
            >
              Try again
            </button>
            {/* A full page load, in case the client router is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="rounded-control border border-line px-6 py-3 font-semibold"
            >
              Go to the home page
            </a>
          </div>
          {error.digest ? (
            <p className="mt-8 text-sm">Reference: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
