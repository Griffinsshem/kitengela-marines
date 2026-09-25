"use client";

import { ArticleForm } from "@/components/admin/ArticleForm";

export default function NewArticlePage() {
  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Write an article</h1>
      <p className="mt-2 text-muted">
        Saved drafts stay private until published. Nothing here reaches the website until you
        publish it.
      </p>
      <div className="mt-8">
        <ArticleForm />
      </div>
    </div>
  );
}
