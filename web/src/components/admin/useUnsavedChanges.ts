"use client";

import { useCallback, useEffect, useState } from "react";

import { isLeavingWithinSite, LEAVE_WARNING } from "@/lib/unsaved";

/**
 * Warn before an editor leaves a form with changes that were never saved.
 *
 * `value` is whatever the form would save. Until the editor first touches the
 * form, the baseline follows `value`, so defaults a form fills in by itself
 * (the first team in a list, say) never count as changes.
 *
 * Covers both ways out: closing or reloading the tab (the browser's own
 * prompt) and clicking a link inside the site. Next.js has no route-change
 * event to cancel, so links are checked in the capture phase, before the
 * router's own click handler runs.
 */
export function useUnsavedChanges(value: unknown) {
  const serialized = JSON.stringify(value);
  const [baseline, setBaseline] = useState(serialized);
  const [touched, setTouched] = useState(false);

  if (!touched && baseline !== serialized) setBaseline(serialized);
  const dirty = touched && serialized !== baseline;

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers need a value set; the text itself is never shown.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const leaving = isLeavingWithinSite(
        {
          href: target.href,
          target: target.target,
          download: target.hasAttribute("download"),
        },
        event,
        window.location,
      );
      if (leaving && !window.confirm(LEAVE_WARNING)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const touch = useCallback(() => setTouched(true), []);
  const markSaved = useCallback(
    (saved: unknown) => setBaseline(JSON.stringify(saved)),
    [],
  );

  return { dirty, touch, markSaved };
}
