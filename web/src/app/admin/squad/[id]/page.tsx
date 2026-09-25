"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { BLANK_PLAYER, PlayerForm, type PlayerDraft } from "@/components/admin/PlayerForm";

type PlayerPayload = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  known_as: string | null;
  display_name: string;
  squad_number: number | null;
  position: string;
  status: string;
  nationality: string | null;
  joined_on: string | null;
  biography: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  internal_notes: string | null;
  team: { slug: string };
  slug: string;
};

export default function EditPlayerPage() {
  const params = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [draft, setDraft] = useState<PlayerDraft | null>(null);
  const [player, setPlayer] = useState<PlayerPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await authFetch(`/admin/players/${params.id}`);
      if (cancelled) return;

      if (!response.ok) {
        setFailed(true);
        return;
      }

      const body: unknown = await response.json();
      const record = (body as { data?: PlayerPayload }).data;
      if (cancelled) return;

      if (!record) {
        setFailed(true);
        return;
      }

      setPlayer(record);
      setDraft({
        ...BLANK_PLAYER,
        id: record.id,
        team_id: record.team_id,
        first_name: record.first_name,
        last_name: record.last_name,
        known_as: record.known_as ?? "",
        squad_number: record.squad_number === null ? "" : String(record.squad_number),
        position: record.position,
        status: record.status,
        nationality: record.nationality ?? "",
        joined_on: record.joined_on ?? "",
        biography: record.biography ?? "",
        photo_url: record.photo_url ?? "",
        date_of_birth: record.date_of_birth ?? "",
        phone: record.phone ?? "",
        emergency_contact_name: record.emergency_contact_name ?? "",
        emergency_contact_phone: record.emergency_contact_phone ?? "",
        internal_notes: record.internal_notes ?? "",
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, params.id]);

  if (failed) {
    return (
      <p className="border border-line bg-chalk px-4 py-3">This player could not be loaded.</p>
    );
  }

  if (!draft || !player) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-headline font-extrabold uppercase">
          {player.display_name}
        </h1>
        <div className="flex gap-4 text-meta">
          <Link href="/admin/squad" className="underline-offset-4 hover:underline">
            All players
          </Link>
          <Link
            href={`/teams/${player.team.slug}/players/${player.slug}`}
            className="font-semibold text-accent-ink underline-offset-4 hover:underline"
          >
            View on site
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <PlayerForm initial={draft} />
      </div>
    </div>
  );
}
