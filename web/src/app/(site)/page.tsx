import type { Metadata } from "next";

import { Hero } from "@/components/home/Hero";
import { LatestNews } from "@/components/home/LatestNews";
import { LatestResult } from "@/components/home/LatestResult";
import { LeagueSnapshot } from "@/components/home/LeagueSnapshot";
import { MediaStrip } from "@/components/home/MediaStrip";
import { NextMatch } from "@/components/home/NextMatch";
import { PartnersSupport } from "@/components/home/PartnersSupport";
import { TeamsSpotlight } from "@/components/home/TeamsSpotlight";
import {
  getClub,
  getLatestArticles,
  getLatestGalleries,
  getLatestResult,
  getNextFixture,
  getSponsors,
  getStandings,
  getTeams,
} from "@/lib/api";

export const metadata: Metadata = {
  title: "Kitengela Marines FC | Official Website",
  description:
    "Fixtures, results, squads and news from Kitengela Marines and Marines Starlets, a football club from Kitengela, Kajiado County.",
};

export default async function HomePage() {
  // Requested together rather than in sequence: eight calls one after another
  // would make the page wait for the slowest chain instead of the slowest call.
  const [club, teams, nextFixture, latestResult, articles, standings, galleries, sponsors] =
    await Promise.all([
      getClub(),
      getTeams(),
      getNextFixture(),
      getLatestResult(),
      getLatestArticles(3),
      getStandings(),
      getLatestGalleries(4),
      getSponsors(),
    ]);

  return (
    <>
      <Hero club={club.ok ? club.data : null}>
        <NextMatch result={nextFixture} />
      </Hero>
      <LatestResult result={latestResult} />
      <TeamsSpotlight result={teams} />
      <LeagueSnapshot result={standings} />
      <LatestNews result={articles} />
      <MediaStrip result={galleries} />
      <PartnersSupport result={sponsors} />
    </>
  );
}
