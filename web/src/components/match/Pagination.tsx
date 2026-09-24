import Link from "next/link";

import type { PaginationMeta } from "@/lib/schemas";

/**
 * Previous and next links.
 *
 * Links rather than buttons, so each page of results has its own URL and the
 * browser's back button behaves as a supporter expects.
 */
export function Pagination({
  meta,
  basePath,
  team,
}: {
  meta: PaginationMeta;
  basePath: string;
  team?: string;
}) {
  if (meta.pages <= 1) return null;

  const href = (page: number) => {
    const query = new URLSearchParams();
    if (team) query.set("team", team);
    if (page > 1) query.set("page", String(page));
    const suffix = query.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6"
    >
      {meta.page > 1 ? (
        <Link
          href={href(meta.page - 1)}
          className="font-semibold underline-offset-4 hover:underline"
        >
          Previous
        </Link>
      ) : (
        <span className="text-muted">Previous</span>
      )}

      <p className="text-meta text-muted">
        Page {meta.page} of {meta.pages}
      </p>

      {meta.page < meta.pages ? (
        <Link
          href={href(meta.page + 1)}
          className="font-semibold underline-offset-4 hover:underline"
        >
          Next
        </Link>
      ) : (
        <span className="text-muted">Next</span>
      )}
    </nav>
  );
}
