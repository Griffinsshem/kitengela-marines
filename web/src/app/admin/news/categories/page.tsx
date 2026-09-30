"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";

/**
 * The sections news is filed under.
 *
 * Categories were seeded once and never manageable, which left the club's news
 * sections as whatever a setup command decided. A club that starts a youth
 * side should be able to file news under it, and one that never writes about
 * the community should be able to stop offering an empty filter.
 *
 * Deleting is refused while articles are filed under a category. The API makes
 * that decision and says how many are in the way; this page shows what it
 * said rather than guessing.
 */

type Category = { id: string; name: string; slug: string };

export default function AdminCategoriesPage() {
  const { authFetch } = useAuth();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/article-categories");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setCategories((body as { data?: Category[] }).data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await authFetch("/admin/article-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { field: string; message: string }[] } })
        ?.error?.details;
      setError(
        details?.length
          ? details.map((d) => d.message).join("; ")
          : ((body as { error?: { message?: string } })?.error?.message ??
              "That category could not be created."),
      );
      return;
    }

    const body: unknown = await response.json();
    const created = (body as { data?: Category }).data;
    if (created) {
      setCategories((current) =>
        [...(current ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }

    setName("");
    setMessage("Category added.");
  }

  async function remove(category: Category) {
    setError(null);
    setMessage(null);

    const response = await authFetch(`/admin/article-categories/${category.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      // A 409 names how many articles are in the way.
      setError(
        (body as { error?: { message?: string } })?.error?.message ??
          "That category could not be deleted.",
      );
      return;
    }

    setCategories((current) => (current ?? []).filter((item) => item.id !== category.id));
    setMessage(`${category.name} removed.`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">News categories</h1>
        <Link href="/admin/news" className="text-meta underline-offset-4 hover:underline">
          All news
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-muted">
        Every story is filed under one of these, and supporters can filter the news page by them.
        A category nobody writes for is a filter that leads nowhere, so it is worth keeping the
        list short.
      </p>

      {message ? (
        <p role="status" className="mt-6 border border-accent-ink bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}

      <div className="mt-8">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Categories could not be loaded just now.
          </p>
        ) : categories === null ? (
          <p className="text-muted">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="border border-line bg-chalk px-4 py-6 text-center text-muted">
            No categories yet. News cannot be published until there is at least one.
          </p>
        ) : (
          <ul className="divide-y divide-line border border-line bg-chalk">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4"
              >
                <span className="font-display text-lg font-extrabold uppercase leading-tight">
                  {category.name}
                </span>
                <span className="text-meta text-muted">/news?category={category.slug}</span>
                <button
                  type="button"
                  onClick={() => void remove(category)}
                  className="ml-auto text-meta font-semibold underline underline-offset-4"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={create} className="mt-10 border border-line bg-chalk p-5">
        <h2 className="font-display text-xl font-extrabold uppercase">Add a category</h2>
        <div className="mt-4 max-w-md">
          <Field label="Name" htmlFor="name" hint="For example, Youth Team.">
            <input
              id="name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={CONTROL_CLASSES}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add category"}
        </button>
      </form>
    </div>
  );
}
