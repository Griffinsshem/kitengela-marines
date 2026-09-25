"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { MarkdownEditor } from "@/components/admin/MarkdownEditor";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { markdownToHtml } from "@/lib/markdown";
import Image from "next/image";

/**
 * Writing and publishing an article.
 *
 * Saving and publishing are separate, as the API keeps them: a draft can be
 * written over several sittings and only becomes public when somebody with
 * PUBLISH_NEWS decides it is ready.
 *
 * The form sends both the markdown the author typed and the HTML derived from
 * it. The API sanitises the HTML regardless of what arrives, so the conversion
 * happening here is a convenience, not a trust boundary.
 */

type Option = { id: string; name: string };

export type ArticleDraft = {
  id?: string;
  title: string;
  summary: string;
  body_markdown: string;
  category_id: string;
  team_id: string;
  byline: string;
  status?: string;
  featured_image_id: string;
  featured_image_url: string;
  featured_image_alt: string;
};

const BLANK: ArticleDraft = {
  title: "",
  summary: "",
  body_markdown: "",
  category_id: "",
  team_id: "",
  byline: "",
  featured_image_id: "",
  featured_image_url: "",
  featured_image_alt: "",
};

export function ArticleForm({ initial }: { initial?: ArticleDraft }) {
  const { authFetch, user } = useAuth();
  const router = useRouter();

  const [draft, setDraft] = useState<ArticleDraft>(initial ?? BLANK);
  const [categories, setCategories] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canPublish = user?.capabilities.includes("publish_news") ?? false;
  const isPublished = draft.status === "published";

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const [categoryResponse, teamResponse] = await Promise.all([
        authFetch("/admin/article-categories"),
        authFetch("/teams"),
      ]);
      if (cancelled) return;

      if (categoryResponse.ok) {
        const body: unknown = await categoryResponse.json();
        const rows = (body as { data?: { id: string; name: string }[] }).data ?? [];
        if (!cancelled) setCategories(rows.map((row) => ({ id: row.id, name: row.name })));
      }

      if (teamResponse.ok) {
        const body: unknown = await teamResponse.json();
        const rows = (body as { data?: { id: string; name: string }[] }).data ?? [];
        if (!cancelled) setTeams(rows.map((row) => ({ id: row.id, name: row.name })));
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const readError = useCallback(async (response: Response): Promise<string> => {
    const body: unknown = await response.json().catch(() => null);
    const details = (body as { error?: { details?: { field: string; message: string }[] } })?.error
      ?.details;
    if (details?.length) return details.map((d) => `${d.field}: ${d.message}`).join("; ");
    return (body as { error?: { message?: string } })?.error?.message ?? "That could not be saved.";
  }, []);

  async function save(): Promise<string | null> {
    const payload = {
      title: draft.title,
      summary: draft.summary || null,
      body_markdown: draft.body_markdown,
      body_html: markdownToHtml(draft.body_markdown),
      category_id: draft.category_id,
      team_id: draft.team_id || null,
      byline: draft.byline || null,
      featured_image_id: draft.featured_image_id || null,
    };

    const response = draft.id
      ? await authFetch(`/admin/articles/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await authFetch("/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      setError(await readError(response));
      return null;
    }

    const body: unknown = await response.json();
    const saved = (body as { data?: { id?: string; status?: string } }).data;
    if (saved?.id) setDraft((current) => ({ ...current, id: saved.id, status: saved.status }));
    return saved?.id ?? null;
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    setNotice(null);

    const id = await save();
    setBusy(false);
    if (!id) return;

    setNotice("Saved.");
    if (!draft.id) router.replace(`/admin/news/${id}`);
  }

  async function onPublish() {
    setBusy(true);
    setError(null);
    setNotice(null);

    // Save first: publishing what is on screen, not what was saved earlier.
    const id = await save();
    if (!id) {
      setBusy(false);
      return;
    }

    const response = await authFetch(`/admin/articles/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    setBusy(false);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    setDraft((current) => ({ ...current, status: "published" }));
    setNotice("Published. It is now on the website.");
    router.refresh();
  }

  async function onUnpublish() {
    if (!draft.id) return;
    setBusy(true);

    const response = await authFetch(`/admin/articles/${draft.id}/unpublish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    setBusy(false);
    if (!response.ok) {
      setError(await readError(response));
      return;
    }

    setDraft((current) => ({ ...current, status: "draft" }));
    setNotice("Unpublished. It is no longer on the website.");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="Title" htmlFor="title" className="lg:col-span-2">
          <input
            id="title"
            required
            maxLength={200}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field
          label="Summary"
          htmlFor="summary"
          hint="One or two sentences. Used on cards and when the story is shared."
          className="lg:col-span-2"
        >
          <textarea
            id="summary"
            rows={2}
            maxLength={300}
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Category" htmlFor="category">
          <select
            id="category"
            required
            value={draft.category_id}
            onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}
            className={CONTROL_CLASSES}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Team" htmlFor="team" hint="Optional. Sets the colours the story carries.">
          <select
            id="team"
            value={draft.team_id}
            onChange={(event) => setDraft({ ...draft, team_id: event.target.value })}
            className={CONTROL_CLASSES}
          >
            <option value="">Club-wide</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Byline" htmlFor="byline" hint="Optional. Leave blank to credit your account.">
          <input
            id="byline"
            maxLength={160}
            value={draft.byline}
            onChange={(event) => setDraft({ ...draft, byline: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>
      </div>

      <div className="border border-line bg-chalk p-4">
        <p className="text-meta font-semibold">Featured image</p>
        <p className="mt-1 text-meta text-muted">
          Shown at the top of the story and when it is shared. Its description travels with it.
        </p>

        {draft.featured_image_url ? (
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <Image
              src={draft.featured_image_url}
              alt={draft.featured_image_alt}
              width={200}
              height={150}
              className="h-28 w-auto object-cover"
            />
            <div>
              <p className="text-meta">{draft.featured_image_alt}</p>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    featured_image_id: "",
                    featured_image_url: "",
                    featured_image_alt: "",
                  })
                }
                className="mt-2 text-meta font-semibold underline underline-offset-4"
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <MediaPicker
            label={draft.featured_image_url ? "Choose a different image" : "Choose an image"}
            onSelect={(asset) =>
              setDraft((current) => ({
                ...current,
                featured_image_id: asset.id,
                featured_image_url: asset.url,
                featured_image_alt: asset.alt,
              }))
            }
          />
        </div>
      </div>

      <MarkdownEditor
        value={draft.body_markdown}
        onChange={(body_markdown) => setDraft({ ...draft, body_markdown })}
      />

      {error ? (
        <p role="alert" className="border border-line bg-chalk px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="border border-accent-ink bg-chalk px-4 py-3 font-semibold">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control border border-line bg-chalk px-5 py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save draft"}
        </button>

        {canPublish && !isPublished ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPublish()}
            className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
          >
            Save and publish
          </button>
        ) : null}

        {canPublish && isPublished ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUnpublish()}
            className="rounded-control border border-line bg-chalk px-5 py-2.5 font-semibold disabled:opacity-60"
          >
            Unpublish
          </button>
        ) : null}

        <p className="text-meta text-muted">
          {isPublished ? "Published" : draft.id ? "Draft" : "Not saved yet"}
        </p>
      </div>
    </form>
  );
}
