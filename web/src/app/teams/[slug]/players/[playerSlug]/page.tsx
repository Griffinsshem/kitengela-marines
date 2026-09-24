import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UnavailableState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getPlayer } from "@/lib/api";
import { formatDate } from "@/lib/datetime";
import type { PlayerStatistics } from "@/lib/schemas";

type Params = { params: Promise<{ slug: string; playerSlug: string }> };

const STATUS_LABEL: Record<string, string> = {
  injured: "Injured",
  suspended: "Suspended",
  inactive: "Not in the current squad",
  former: "Former player",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, playerSlug } = await params;
  const result = await getPlayer(slug, playerSlug);
  if (!result.ok) return { title: "Player" };

  const player = result.data;
  return {
    title: player.display_name,
    description: `${player.display_name}, ${player.position}, ${player.team.name}.`,
    openGraph: player.photo_url
      ? { images: [{ url: player.photo_url, alt: player.display_name }] }
      : undefined,
  };
}

export default async function PlayerPage({ params }: Params) {
  const { slug, playerSlug } = await params;
  const result = await getPlayer(slug, playerSlug);

  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return (
      <Section>
        <UnavailableState what="This player's profile" />
      </Section>
    );
  }

  const player = result.data;
  const accent = toTeamAccentKey(player.team.accent_key);
  const status = STATUS_LABEL[player.status];
  const joined = formatDate(player.joined_on);

  return (
    <div data-team={accent}>
      <section className="bg-pitch text-chalk">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[2fr_3fr] lg:items-end">
          <div className="relative aspect-[3/4] max-w-sm overflow-hidden bg-chalk/5">
            {player.photo_url ? (
              <Image
                src={player.photo_url}
                alt={player.display_name}
                fill
                priority
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover object-top"
              />
            ) : (
              <p className="flex h-full items-center justify-center font-display text-score font-black text-accent-glow">
                {player.squad_number ?? ""}
              </p>
            )}
          </div>

          <div>
            <Link
              href={`/teams/${player.team.slug}`}
              className="text-meta font-semibold uppercase tracking-widest text-accent-glow underline-offset-4 hover:underline"
            >
              {player.team.name}
            </Link>
            <h1 className="mt-3 font-display text-display font-black uppercase leading-none">
              {player.display_name}
            </h1>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              {player.squad_number !== null ? (
                <div>
                  <dt className="text-meta text-chalk/60">Squad number</dt>
                  <dd className="font-display text-3xl font-black tabular-nums">
                    {player.squad_number}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-meta text-chalk/60">Position</dt>
                <dd className="font-display text-3xl font-black capitalize">{player.position}</dd>
              </div>
              {player.nationality ? (
                <div>
                  <dt className="text-meta text-chalk/60">Nationality</dt>
                  <dd className="font-display text-3xl font-black">{player.nationality}</dd>
                </div>
              ) : null}
            </dl>
            {status ? (
              <p className="mt-6 inline-block border border-chalk/30 px-3 py-1 text-meta font-semibold">
                {status}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
          <div>
            <h2 className="border-b border-line pb-2 font-display text-headline font-extrabold uppercase">
              {player.statistics_season
                ? `${player.statistics_season} statistics`
                : "Season statistics"}
            </h2>
            <Statistics statistics={player.statistics} />
            {joined ? <p className="mt-6 text-meta text-muted">At the club since {joined}</p> : null}
          </div>

          {player.biography ? (
            <div>
              <h2 className="border-b border-line pb-2 font-display text-headline font-extrabold uppercase">
                Profile
              </h2>
              <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">
                {player.biography}
              </p>
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

/**
 * Season totals.
 *
 * Aggregated from match records, so a player with no appearances shows zeros
 * rather than nothing: the club has played no matches yet, and that is the
 * honest number. Goalkeeping rows appear only for goalkeepers, because the API
 * omits them entirely for outfield players.
 */
function Statistics({ statistics }: { statistics: PlayerStatistics }) {
  const rows: [string, number][] = [
    ["Appearances", statistics.appearances],
    ["Starts", statistics.starts],
    ["Minutes played", statistics.minutes_played],
    ["Goals", statistics.goals],
    ["Assists", statistics.assists],
    ["Yellow cards", statistics.yellow_cards],
    ["Red cards", statistics.red_cards],
  ];

  if (statistics.clean_sheets !== undefined) rows.push(["Clean sheets", statistics.clean_sheets]);
  if (statistics.saves !== undefined) rows.push(["Saves", statistics.saves]);
  if (statistics.goals_conceded !== undefined) {
    rows.push(["Goals conceded", statistics.goals_conceded]);
  }

  return (
    <dl className="mt-6 grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-chalk px-4 py-5">
          <dt className="text-meta text-muted">{label}</dt>
          <dd className="mt-1 font-display text-3xl font-black tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
