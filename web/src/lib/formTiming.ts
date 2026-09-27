"use client";

import { useEffect, useState } from "react";

import { API_URL } from "@/lib/session";

/**
 * When this form was put on screen, according to the server's clock.
 *
 * The API drops submissions that arrive within a few seconds of the form
 * rendering, because people do not read and answer a form that fast but bots
 * do. Timing it with the visitor's own clock would punish anyone whose device
 * is set wrong: a phone running a few minutes fast would make every message
 * look instant, and it would be dropped without the sender being told.
 *
 * So the anchor comes from the Date header the API returns. If it cannot be
 * read, this stays null and the timestamp is simply omitted — the API treats a
 * missing one as acceptable, and rate limiting still applies.
 */
export function useServerRenderedAt(): number | null {
  const [renderedAt, setRenderedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function anchor() {
      try {
        const response = await fetch(`${API_URL}/api/v1/health`, { method: "GET" });
        const date = response.headers.get("Date");
        if (!cancelled && date) setRenderedAt(new Date(date).getTime() / 1000);
      } catch {
        // Leave it null: better to send nothing than a wrong time.
      }
    }

    void anchor();
    return () => {
      cancelled = true;
    };
  }, []);

  return renderedAt;
}
