"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { cn } from "@/lib/cn";
import { formatDate, formatKickoff } from "@/lib/datetime";

/**
 * Messages sent through the public forms.
 *
 * Everything here was typed by a stranger, so it is rendered as text and never
 * as markup: the API stores it exactly as sent, and nothing in a message can
 * run in this page.
 *
 * New messages lead, because that is what somebody opening this page came for.
 */

type Submission = {
  id: string;
  kind: string;
  status: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  organisation: string | null;
  interest: string | null;
  internal_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
};

const STATUSES = [
  ["new", "New"],
  ["read", "Read"],
  ["replied", "Replied"],
  ["closed", "Closed"],
  ["spam", "Spam"],
] as const;

const KIND_LABEL: Record<string, string> = {
  contact: "Contact",
  partnership: "Partnership",
};

export default function AdminSubmissionsPage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/submissions?per_page=50");
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }
      const body: unknown = await response.json();
      if (!cancelled) setRows((body as { data?: Submission[] }).data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function setStatus(submission: Submission, status: string) {
    setMessage(null);

    const response = await authFetch(`/admin/submissions/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setMessage("That could not be saved.");
      return;
    }

    const body: unknown = await response.json();
    const updated = (body as { data?: Submission }).data;
    if (updated) {
      setRows((current) =>
        (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  }

  async function remove(submission: Submission) {
    const response = await authFetch(`/admin/submissions/${submission.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("That could not be deleted.");
      return;
    }
    setRows((current) => (current ?? []).filter((item) => item.id !== submission.id));
    setMessage("Message deleted.");
  }

  const unread = rows?.filter((row) => row.status === "new").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">Messages</h1>
        {rows && unread > 0 ? (
          <p className="text-meta font-semibold text-accent-ink">
            {unread} new {unread === 1 ? "message" : "messages"}
          </p>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="mt-6 border border-line bg-chalk px-4 py-3 font-semibold">
          {message}
        </p>
      ) : null}

      <div className="mt-8">
        {failed ? (
          <p className="border border-line bg-chalk px-4 py-3">
            Messages could not be loaded just now.
          </p>
        ) : rows === null ? (
          <p className="text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="border border-line bg-chalk px-6 py-10 text-center">
            <p className="font-display text-xl font-extrabold uppercase">No messages yet</p>
            <p className="mx-auto mt-3 max-w-md text-muted">
              Anything sent through the contact and partnership forms arrives here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const expanded = open === row.id;
              return (
                <li key={row.id} className="border border-line bg-chalk">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                      setOpen(expanded ? null : row.id);
                      // Opening a new message marks it read, which is what
                      // reading it means.
                      if (!expanded && row.status === "new") void setStatus(row, "read");
                    }}
                    className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4 text-left hover:bg-turf"
                  >
                    <span
                      className={cn(
                        "font-display text-lg uppercase leading-tight",
                        row.status === "new" ? "font-black" : "font-extrabold text-muted",
                      )}
                    >
                      {row.name}
                    </span>
                    <span className="text-meta font-semibold text-accent-ink">
                      {KIND_LABEL[row.kind] ?? row.kind}
                    </span>
                    {row.organisation ? (
                      <span className="text-meta text-muted">{row.organisation}</span>
                    ) : null}
                    <span className="text-meta text-muted">
                      {formatDate(row.created_at)}, {formatKickoff(row.created_at)}
                    </span>
                    {row.status !== "new" ? (
                      <span className="border border-line px-2 py-0.5 text-meta font-semibold capitalize">
                        {row.status}
                      </span>
                    ) : null}
                  </button>

                  {expanded ? (
                    <div className="border-t border-line px-4 py-5">
                      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-meta text-muted">Email</dt>
                          <dd className="font-semibold">
                            <a
                              href={`mailto:${row.email}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {row.email}
                            </a>
                          </dd>
                        </div>
                        {row.phone ? (
                          <div>
                            <dt className="text-meta text-muted">Phone</dt>
                            <dd className="font-semibold">
                              <a
                                href={`tel:${row.phone.replace(/\s/g, "")}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {row.phone}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                        {row.subject ? (
                          <div>
                            <dt className="text-meta text-muted">Subject</dt>
                            <dd className="font-semibold">{row.subject}</dd>
                          </div>
                        ) : null}
                        {row.interest ? (
                          <div>
                            <dt className="text-meta text-muted">Interested in</dt>
                            <dd className="font-semibold">{row.interest}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {/* Rendered as text, never as markup. */}
                      <p className="mt-5 whitespace-pre-line border-l-4 border-accent pl-4 text-lg leading-relaxed">
                        {row.message}
                      </p>

                      {row.handled_by ? (
                        <p className="mt-4 text-meta text-muted">
                          Handled by {row.handled_by}
                          {row.handled_at ? ` on ${formatDate(row.handled_at)}` : ""}
                        </p>
                      ) : null}

                      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                        {STATUSES.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => void setStatus(row, value)}
                            aria-pressed={row.status === value}
                            className={cn(
                              "rounded-control border px-3 py-1.5 text-meta font-semibold",
                              row.status === value
                                ? "border-accent-ink bg-accent-ink text-chalk"
                                : "border-line hover:bg-turf",
                            )}
                          >
                            {label}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          className="ml-auto text-meta font-semibold underline underline-offset-4"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
