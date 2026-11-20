/**
 * Pure helpers behind the admin lists' "Load more".
 *
 * The API pages by offset. If a row is deleted or added between two page
 * loads, the next page shifts by one, so a row can arrive twice. Merging by
 * id keeps each record listed once, in the order first seen.
 */

export type PageMeta = { page: number; pages: number; total: number };

export function mergePage<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const seen = new Set(existing.map((row) => row.id));
  const fresh = incoming.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}

export function hasMorePages(meta: PageMeta | null): boolean {
  return meta !== null && meta.page < meta.pages;
}

export function readPage<T>(body: unknown): {
  rows: T[];
  meta: PageMeta | null;
} {
  if (typeof body !== "object" || body === null)
    return { rows: [], meta: null };
  const { data, meta } = body as { data?: unknown; meta?: Partial<PageMeta> };
  const rows = Array.isArray(data) ? (data as T[]) : [];
  const valid =
    meta &&
    typeof meta.page === "number" &&
    typeof meta.pages === "number" &&
    typeof meta.total === "number";
  return { rows, meta: valid ? (meta as PageMeta) : null };
}

export function withPage(path: string, page: number, perPage: number): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  return `${base}?${params.toString()}`;
}
