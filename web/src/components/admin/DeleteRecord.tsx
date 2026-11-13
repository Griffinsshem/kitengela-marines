"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { hasCapability } from "@/lib/session";

/**
 * The "Delete" section at the foot of a fixture or player page.
 *
 * Two steps, never one. The first click only asks the API what the delete
 * would take with it (a result, goals, appearances) and lists it in plain
 * words. The second, on a button that names the record, does it. Records with
 * nothing depending on them still get the second step: deleting is never a
 * single stray click.
 *
 * Shown only to Club Admins, the one role the API lets delete these. Anyone
 * else would only ever see a refusal, so they do not see the section.
 */

export type Impact = Record<string, unknown> & { requires_confirmation: boolean };

type Stage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "review"; impact: Impact }
  | { kind: "deleting"; impact: Impact }
  | { kind: "failed"; message: string };

export function DeleteRecord({
  apiPath,
  name,
  noun,
  describe,
  alternative,
  returnTo,
}: {
  /** The record's admin path, e.g. `/admin/fixtures/<id>`. */
  apiPath: string;
  /** What the record is called, used on the confirming button. */
  name: string;
  /** "match" or "player", for the copy. */
  noun: string;
  /** Turns the API's breakdown into sentences, one per consequence. */
  describe: (impact: Impact) => string[];
  /** A gentler option worth mentioning before deleting, if there is one. */
  alternative?: ReactNode;
  /** Where to go once it is gone. */
  returnTo: string;
}) {
  const { authFetch, user } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  if (!hasCapability(user, "manage_users")) return null;

  async function review() {
    setStage({ kind: "checking" });
    const response = await authFetch(`${apiPath}/deletion`);
    if (!response.ok) {
      setStage({ kind: "failed", message: `This ${noun} could not be checked just now.` });
      return;
    }
    const body: unknown = await response.json();
    const impact = (body as { data?: Impact }).data;
    if (!impact) {
      setStage({ kind: "failed", message: `This ${noun} could not be checked just now.` });
      return;
    }
    setStage({ kind: "review", impact });
  }

  async function remove(impact: Impact) {
    setStage({ kind: "deleting", impact });
    // Confirmed only when the API said confirmation is needed, so a record
    // that gained a result since the review is refused rather than deleted.
    const query = impact.requires_confirmation ? "?confirm=true" : "";
    const response = await authFetch(`${apiPath}${query}`, { method: "DELETE" });

    if (response.ok) {
      router.push(returnTo);
      return;
    }
    if (response.status === 409) {
      // Something changed between the review and the click: show it again.
      const body: unknown = await response.json().catch(() => null);
      const details = (body as { error?: { details?: Impact } } | null)?.error?.details;
      if (details) {
        setStage({ kind: "review", impact: details });
        return;
      }
    }
    setStage({ kind: "failed", message: `This ${noun} could not be deleted just now.` });
  }

  const consequences =
    stage.kind === "review" || stage.kind === "deleting" ? describe(stage.impact) : [];

  return (
    <section className="mt-16 border-t border-line pt-8">
      <h2 className="font-display text-xl font-extrabold uppercase">Delete</h2>

      {stage.kind === "idle" || stage.kind === "checking" || stage.kind === "failed" ? (
        <>
          <p className="mt-2 max-w-2xl text-muted">
            Removes this {noun} from the website and the admin. It cannot be undone.
          </p>
          {alternative ? <p className="mt-2 max-w-2xl text-muted">{alternative}</p> : null}
          {stage.kind === "failed" ? (
            <p role="alert" className="mt-4 border border-line bg-chalk px-4 py-3">
              {stage.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void review()}
            disabled={stage.kind === "checking"}
            className="mt-5 inline-flex min-h-11 items-center rounded-control border border-current px-5 font-semibold transition active:scale-[0.98] disabled:opacity-60"
          >
            {stage.kind === "checking" ? "Checking…" : `Delete this ${noun}…`}
          </button>
        </>
      ) : (
        <div className="mt-4 max-w-2xl border-2 border-pitch bg-chalk p-5">
          <p className="font-semibold">Deleting {name} will:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-meta text-muted">This cannot be undone.</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void remove(stage.impact)}
              disabled={stage.kind === "deleting"}
              className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 font-semibold text-chalk transition active:scale-[0.98] disabled:opacity-60"
            >
              {stage.kind === "deleting" ? "Deleting…" : `Delete ${name}`}
            </button>
            <button
              type="button"
              onClick={() => setStage({ kind: "idle" })}
              disabled={stage.kind === "deleting"}
              className="inline-flex min-h-11 items-center rounded-control border border-line px-5 font-semibold"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
