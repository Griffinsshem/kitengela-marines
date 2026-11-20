"use client";

/** The foot of a paged admin list: how much is showing, and a way to get the rest. */
export function LoadMore({
  shown,
  total,
  hasMore,
  loading,
  failed,
  onLoadMore,
  noun = "items",
}: {
  shown: number;
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => void;
  noun?: string;
}) {
  if (!hasMore && !failed) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        aria-busy={loading}
        className="rounded-control border border-line px-5 py-2.5 font-semibold hover:bg-turf disabled:opacity-60"
      >
        {loading ? "Loading…" : `Load more ${noun}`}
      </button>
      <p className="text-meta text-muted" aria-live="polite">
        {failed
          ? "The next page could not be loaded. Try again."
          : total !== null
            ? `Showing ${shown} of ${total}`
            : null}
      </p>
    </div>
  );
}
