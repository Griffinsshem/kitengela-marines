"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { DeleteRecord } from "@/components/admin/DeleteRecord";
import { BLANK_FIXTURE, FixtureForm, type FixtureDraft } from "@/components/admin/FixtureForm";
import { ResultForm } from "@/components/admin/ResultForm";
import { formatDayMonth, nairobiDayKey } from "@/lib/datetime";
import { describeFixtureDeletion } from "@/lib/deletion";
import type { RecordedResult } from "@/lib/result-record";

type FixturePayload = {
  id: string;
  slug: string;
  status: string;
  venue: string;
  venue_name: string | null;
  kickoff_at: string | null;
  scheduled_on: string | null;
  team: { slug: string; short_name: string };
  opponent: { name: string };
  team_id: string;
  season_id: string;
  opponent_id: string;
  is_completed: boolean;
} & Omit<RecordedResult, "is_completed">;

/**
 * Splits the kick-off instant back into the date and time boxes the form uses,
 * in Kenyan time rather than the browser's, so a Team Manager travelling sees
 * the same 15:00 the club entered.
 */
function localParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export default function EditFixturePage() {
  const params = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [fixture, setFixture] = useState<FixturePayload | null>(null);
  const [draft, setDraft] = useState<FixtureDraft | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch(`/admin/fixtures/${params.id}`);
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body: unknown = await response.json();
      const record = (body as { data?: FixturePayload }).data;
      if (cancelled) return;

      if (!record) {
        setFailed(true);
        return;
      }

      const { date, time } = localParts(record.kickoff_at);
      setFixture(record);
      setDraft({
        ...BLANK_FIXTURE,
        id: record.id,
        team_id: record.team_id,
        season_id: record.season_id,
        opponent_id: record.opponent_id,
        venue: record.venue,
        venue_name: record.venue_name ?? "",
        date: date || (record.scheduled_on ?? ""),
        time,
        // 'completed' is not an editable status; recording a result is what
        // sets it, so the dropdown falls back to scheduled.
        status: record.status === "completed" ? "scheduled" : record.status,
        is_completed: record.is_completed,
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, params.id]);

  if (failed) {
    return (
      <p className="border border-line bg-chalk px-4 py-3">This fixture could not be loaded.</p>
    );
  }

  if (!draft || !fixture) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">
          {fixture.team.short_name} v {fixture.opponent.name}
        </h1>
        <div className="flex gap-4 text-meta">
          <Link href="/admin/fixtures" className="underline-offset-4 hover:underline">
            All fixtures
          </Link>
          <Link
            href={`/matches/${fixture.slug}`}
            className="font-semibold text-accent-ink underline-offset-4 hover:underline"
          >
            View on site
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
          Scheduling
        </h2>
        <div className="mt-6">
          <FixtureForm initial={draft} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b border-line pb-2 font-display text-xl font-extrabold uppercase">
          {fixture.is_completed ? "Correct the result" : "Record the result"}
        </h2>
        <div className="mt-6">
          <ResultForm
            // Re-mounts with fresh fields if the record is reloaded.
            key={fixture.id}
            fixtureId={fixture.id}
            teamSlug={fixture.team.slug}
            ourName={fixture.team.short_name}
            opponentName={fixture.opponent.name}
            recorded={{
              is_completed: fixture.is_completed,
              our_score: fixture.our_score,
              their_score: fixture.their_score,
              report: fixture.report,
              player_of_the_match_id: fixture.player_of_the_match_id,
              lineup: fixture.lineup,
              events: fixture.events,
              players: fixture.players,
            }}
          />
        </div>
      </section>

      <DeleteRecord
        apiPath={`/admin/fixtures/${fixture.id}`}
        name={fixtureName(fixture)}
        noun="match"
        describe={describeFixtureDeletion}
        alternative="If the match was called off rather than entered by mistake, set its status to postponed or cancelled instead, so supporters can see what happened."
        returnTo="/admin/fixtures"
      />
    </div>
  );
}

/** "Marines v Isinya United, 3 Oct": the date tells two duplicates apart. */
function fixtureName(fixture: FixturePayload): string {
  const day = fixture.kickoff_at
    ? nairobiDayKey(new Date(fixture.kickoff_at))
    : fixture.scheduled_on;
  const date = formatDayMonth(day);
  const name = `${fixture.team.short_name} v ${fixture.opponent.name}`;
  return date ? `${name}, ${date}` : name;
}
