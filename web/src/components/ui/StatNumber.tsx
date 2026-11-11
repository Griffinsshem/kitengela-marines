"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A season total that rolls up to its value, odometer-style, the first time it
 * scrolls into view.
 *
 * The server renders the real figure, so it is correct with no JavaScript, in a
 * crawler and in a cached page. The roll only happens when all of these hold:
 *
 * - the visitor has not asked for reduced motion;
 * - the figure was still below the fold when the script arrived. Anything
 *   already on screen keeps its value rather than flashing to nought and back.
 *
 * Only totals roll. A match score never does: for a moment it would show a
 * scoreline that never happened, where a season total rising to its value is
 * read, correctly, as adding up.
 *
 * Screen readers are given the final value once; the moving digits are hidden
 * from them so nobody hears a count.
 */

const DURATION_MS = 900;

// Quint ease-out, the same curve as the CSS motion tokens.
function easeOut(progress: number): number {
  return 1 - Math.pow(1 - progress, 5);
}

function format(value: number, signed: boolean): string {
  return signed && value > 0 ? `+${value}` : String(value);
}

export function StatNumber({ value, signed = false }: { value: number; signed?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || value === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    // Already visible when the script arrived: leave the figure alone.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    let frame = 0;
    setShown(0);

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS);
          setShown(Math.round(value * easeOut(progress)));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [value]);

  return (
    <span ref={ref}>
      <span className="sr-only">{format(value, signed)}</span>
      <span aria-hidden="true">{format(shown, signed)}</span>
    </span>
  );
}
