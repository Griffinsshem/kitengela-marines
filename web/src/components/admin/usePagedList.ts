"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import {
  hasMorePages,
  mergePage,
  readPage,
  withPage,
  type PageMeta,
} from "@/lib/paging";

/**
 * An admin list that loads the first page, then more on request.
 *
 * Before this, each list asked for one page of 50 or 100 and silently showed
 * nothing past it: a club with a few seasons of results could not open its
 * oldest matches at all.
 */
export function usePagedList<T extends { id: string }>(
  path: string,
  perPage = 50,
  enabled = true,
) {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<T[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      const response = await authFetch(withPage(path, 1, perPage));
      if (cancelled) return;
      if (!response.ok) {
        setFailed(true);
        return;
      }
      const page = readPage<T>(await response.json());
      if (cancelled) return;
      setRows(page.rows);
      setMeta(page.meta);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, enabled, path, perPage]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !meta || !hasMorePages(meta)) return;
    inFlight.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const response = await authFetch(withPage(path, meta.page + 1, perPage));
      if (!response.ok) {
        setMoreFailed(true);
        return;
      }
      const page = readPage<T>(await response.json());
      setRows((current) => mergePage(current ?? [], page.rows));
      setMeta(page.meta);
    } catch {
      setMoreFailed(true);
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [authFetch, meta, path, perPage]);

  return {
    rows,
    setRows,
    failed,
    total: meta?.total ?? null,
    hasMore: hasMorePages(meta),
    loadMore,
    loadingMore,
    moreFailed,
  };
}
