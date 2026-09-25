"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ArticleForm, type ArticleDraft } from "@/components/admin/ArticleForm";
import { useAuth } from "@/components/admin/AuthProvider";

type LoadedArticle = { draft: ArticleDraft; slug: string };

type ArticlePayload = {
  id: string;
  title: string;
  summary: string | null;
  body_markdown: string | null;
  slug: string;
  status: string;
  byline: string | null;
  category_id?: string;
  team_id?: string | null;
};

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [loaded, setLoaded] = useState<LoadedArticle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch(`/admin/articles/${params.id}`);
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body: unknown = await response.json();
      const article = (body as { data?: ArticlePayload }).data;
      if (cancelled) return;

      if (!article) {
        setFailed(true);
        return;
      }

      setLoaded({
        slug: article.slug,
        draft: {
          id: article.id,
          title: article.title,
          summary: article.summary ?? "",
          // An article written before this editor existed has no markdown
          // source. It opens blank rather than showing the writer raw HTML.
          body_markdown: article.body_markdown ?? "",
          category_id: article.category_id ?? "",
          team_id: article.team_id ?? "",
          byline: article.byline ?? "",
          status: article.status,
        },
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, params.id]);

  if (failed) {
    return (
      <p className="border border-line bg-chalk px-4 py-3">This article could not be loaded.</p>
    );
  }

  if (!loaded) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">Edit article</h1>
        <div className="flex gap-4 text-meta">
          <Link href="/admin/news" className="underline-offset-4 hover:underline">
            All articles
          </Link>
          {loaded.draft.status === "published" ? (
            <Link
              href={`/news/${loaded.slug}`}
              className="font-semibold text-accent-ink underline-offset-4 hover:underline"
            >
              View on site
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-8">
        <ArticleForm initial={loaded.draft} />
      </div>
    </div>
  );
}
