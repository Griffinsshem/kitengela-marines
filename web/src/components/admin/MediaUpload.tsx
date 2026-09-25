"use client";

import { useRef, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import type { MediaAsset } from "@/components/admin/media";

/**
 * Uploading a photograph.
 *
 * Alt text is required here because it is required by the API: a photograph
 * with no description is invisible to a supporter using a screen reader, and
 * the moment to write it is while the person uploading can still see the
 * picture.
 *
 * The request carries no Content-Type header. A multipart upload needs a
 * boundary marker that only the browser can generate, and setting the header
 * by hand would omit it and break the request.
 */
export function MediaUpload({ onUploaded }: { onUploaded: (asset: MediaAsset) => void }) {
  const { authFetch } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("alt_text", altText);
    if (caption.trim()) form.append("caption", caption.trim());

    const response = await authFetch("/admin/media/uploads", { method: "POST", body: form });
    setBusy(false);

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { field: string; message: string }[] } })
        ?.error?.details;
      setError(
        details?.length
          ? details.map((d) => d.message).join("; ")
          : ((body as { error?: { message?: string } })?.error?.message ??
              "The photograph could not be uploaded."),
      );
      return;
    }

    const body: unknown = await response.json();
    const asset = (body as { data?: MediaAsset }).data;
    if (asset) onUploaded(asset);

    setFile(null);
    setAltText("");
    setCaption("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form onSubmit={submit} className="border border-line bg-chalk p-5">
      <h2 className="font-display text-xl font-extrabold uppercase">Add a photograph</h2>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Field label="Photograph" htmlFor="file" hint="JPEG, PNG or WebP.">
          <input
            id="file"
            ref={fileRef}
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field
          label="Describe the photograph"
          htmlFor="alt_text"
          hint="What it shows, for supporters who cannot see it."
        >
          <input
            id="alt_text"
            required
            maxLength={250}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>

        <Field label="Caption" htmlFor="caption" hint="Optional. Shown beneath the photograph.">
          <input
            id="caption"
            maxLength={500}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className={CONTROL_CLASSES}
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="mt-4 border border-line px-4 py-3 font-semibold">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !file}
        className="mt-4 rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
