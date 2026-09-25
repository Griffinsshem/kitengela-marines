"use client";

import { useRef, useState } from "react";

import { CONTROL_CLASSES, Field } from "@/components/admin/Field";
import { cn } from "@/lib/cn";
import { markdownToHtml } from "@/lib/markdown";

/**
 * Writing surface for an article.
 *
 * A textarea, a few buttons that insert markdown, and a preview rendered by
 * the same converter that runs on save — so what the writer sees is what the
 * page will show, and nothing in the preview can be silently stripped later.
 *
 * The buttons wrap the current selection, which is what makes markdown
 * bearable for someone who does not want to learn it.
 */

type Insertion = { label: string; before: string; after: string; block?: boolean };

const ACTIONS: Insertion[] = [
  { label: "Bold", before: "**", after: "**" },
  { label: "Italic", before: "*", after: "*" },
  { label: "Link", before: "[", after: "](https://)" },
  { label: "Heading", before: "## ", after: "", block: true },
  { label: "Quote", before: "> ", after: "", block: true },
  { label: "List", before: "- ", after: "", block: true },
];

export function MarkdownEditor({
  value,
  onChange,
  id = "body",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  function apply(action: Insertion) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);

    // A block action belongs at the start of the line, not around the words.
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const next = action.block
      ? `${value.slice(0, lineStart)}${action.before}${value.slice(lineStart)}`
      : `${value.slice(0, selectionStart)}${action.before}${selected}${action.after}${value.slice(selectionEnd)}`;

    onChange(next);
    // Put the cursor back where the writer expects it.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = action.block
        ? selectionStart + action.before.length
        : selectionStart + action.before.length + selected.length;
      textarea.setSelectionRange(caret, caret);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => apply(action)}
              className="rounded-control border border-line bg-chalk px-3 py-1.5 text-meta font-semibold hover:bg-turf"
            >
              {action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={showPreview}
          onClick={() => setShowPreview((shown) => !shown)}
          className={cn(
            "rounded-control border px-3 py-1.5 text-meta font-semibold",
            showPreview ? "border-accent-ink bg-accent-ink text-chalk" : "border-line bg-chalk",
          )}
        >
          Preview
        </button>
      </div>

      <div className={cn("mt-3 grid gap-4", showPreview && "lg:grid-cols-2")}>
        <Field
          label="Article"
          htmlFor={id}
          hint="**bold**, *italics*, ## heading, > quote, - list, [text](https://link)"
        >
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={18}
            className={cn(CONTROL_CLASSES, "font-mono text-base")}
          />
        </Field>

        {showPreview ? (
          <div>
            <p className="text-meta font-semibold">Preview</p>
            <div className="mt-2 max-h-[32rem] overflow-y-auto border border-line bg-chalk p-5">
              {/*
                Rendered by the same converter used on save, which escapes
                every character of input before adding markup. Nothing here
                can contain HTML the writer typed.
              */}
              <div
                className="article-body"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
