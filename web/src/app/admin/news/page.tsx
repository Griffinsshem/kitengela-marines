"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { formatDate } from "@/lib/datetime";

type Row = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  category: { name: string };
  author: string;
};

/**
 * Every article, drafts first.
 *
 * A Media Officer opens this page to continue something unfinished far more
 * often than to admire what is already live, so drafts lead.
 */
export default function AdminNewsPage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/articles?per_page=50");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setRows((body as { data?: Row[] }).data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const drafts = rows?.filter((row) => row.status !== "published") ?? [];
  const published = rows?.filter((row) => row.status === "published") ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">News</h1>
        <Link
          href="/admin/news/new"
          className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight"
        >
          Write an article
        </Link>
      </div>

      {failed ? (
        <p className="mt-8 border border-line bg-chalk px-4 py-3">
          Articles could not be loaded just now.
        </p>
      ) : rows === null ? (
        <p className="mt-8 text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 border border-line bg-chalk px-6 py-10 text-center">
          <p className="font-display text-xl font-extrabold uppercase">Nothing written yet</p>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Match reports, team news and announcements written here appear on the club website
            once published.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <ArticleGroup title="Drafts and scheduled" rows={drafts} />
          <ArticleGroup title="Published" rows={published} />
        </div>
      )}
    </div>
  );
}

function ArticleGroup({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
        {title}
      </h2>
      <ul className="mt-4 divide-y divide-line border border-line bg-chalk">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/admin/news/${row.id}`} className="block px-4 py-4 hover:bg-turf">
              <p className="font-display text-lg font-extrabold uppercase leading-tight">
                {row.title}
              </p>
              <p className="mt-1 text-meta text-muted">
                {row.category.name} — {row.author}
                {row.published_at ? ` — ${formatDate(row.published_at)}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
