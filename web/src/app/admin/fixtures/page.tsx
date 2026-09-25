"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { formatDayMonth, formatKickoff, formatMatchDate } from "@/lib/datetime";

type Row = {
  id: string;
  status: string;
  venue: string;
  kickoff_at: string | null;
  scheduled_on: string | null;
  team: { short_name: string };
  opponent: { name: string };
  our_score: number | null;
  their_score: number | null;
  is_completed: boolean;
};

/**
 * Every fixture in one list.
 *
 * Unlike the public site this does not split fixtures from results: an editor
 * is looking for one particular match, and remembering whether it has been
 * played yet is not their job.
 */
export default function AdminFixturesPage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch("/admin/fixtures?per_page=100");
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

  const upcoming = rows?.filter((row) => !row.is_completed) ?? [];
  const played = rows?.filter((row) => row.is_completed) ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">Fixtures</h1>
        <Link
          href="/admin/fixtures/new"
          className="rounded-control bg-highlight px-5 py-2.5 font-semibold text-on-highlight"
        >
          Add a fixture
        </Link>
      </div>

      {failed ? (
        <p className="mt-8 border border-line bg-chalk px-4 py-3">
          Fixtures could not be loaded just now.
        </p>
      ) : rows === null ? (
        <p className="mt-8 text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 border border-line bg-chalk px-6 py-10 text-center">
          <p className="font-display text-xl font-extrabold uppercase">No fixtures yet</p>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Fixtures added here appear on the website, and move to results once a score is
            recorded.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <FixtureGroup title="To play" rows={upcoming} />
          <FixtureGroup title="Played" rows={played} />
        </div>
      )}
    </div>
  );
}

function FixtureGroup({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
        {title}
      </h2>
      <ul className="mt-4 divide-y divide-line border border-line bg-chalk">
        {rows.map((row) => {
          const date = formatMatchDate(row.kickoff_at) ?? formatDayMonth(row.scheduled_on);
          const kickoff = formatKickoff(row.kickoff_at);
          return (
            <li key={row.id}>
              <Link
                href={`/admin/fixtures/${row.id}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4 hover:bg-turf"
              >
                <span className="font-display text-lg font-extrabold uppercase leading-tight">
                  {row.team.short_name} v {row.opponent.name}
                </span>
                {row.is_completed ? (
                  <span className="font-display text-lg font-black tabular-nums text-accent-ink">
                    {row.our_score}–{row.their_score}
                  </span>
                ) : null}
                <span className="text-meta capitalize text-muted">{row.venue}</span>
                <span className="text-meta text-muted">
                  {date ?? "Date to be confirmed"}
                  {kickoff ? `, ${kickoff}` : ""}
                </span>
                {row.status !== "scheduled" && !row.is_completed ? (
                  <span className="border border-line px-2 py-0.5 text-meta font-semibold capitalize">
                    {row.status}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
