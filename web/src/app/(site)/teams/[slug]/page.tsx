import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MatchCard } from "@/components/match/MatchCard";
import { NewsCard } from "@/components/news/NewsCard";
import { SquadGrid } from "@/components/team/SquadGrid";
import { StaffCard } from "@/components/team/StaffCard";
import { TeamHero } from "@/components/team/TeamHero";
import { TeamSwitcher } from "@/components/team/TeamSwitcher";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getSquad, getStaff, getTeam, getTeamArticles, getTeams } from "@/lib/api";

type Params = { params: Promise<{ slug: string }> };

/**
 * Prerender a page per team at build time.
 *
 * There are two teams, and they change about as often as the club adds a side.
 * If the API is unreachable during a build this returns nothing and the pages
 * are rendered on demand instead, so a deploy never fails over it.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const result = await getTeams();
  return result.ok ? result.data.map((team) => ({ slug: team.slug })) : [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await getTeam(slug);
  if (!result.ok) return { title: "Team" };

  return {
    title: result.data.name,
    description:
      result.data.summary ??
      `Squad, fixtures and results for ${result.data.name}, Kitengela Marines.`,
  };
}

export default async function TeamPage({ params }: Params) {
  const { slug } = await params;
  const team = await getTeam(slug);

  // A team that does not exist is a 404. A team we could not load is not:
  // telling a supporter the Starlets do not exist because our API is down
  // would be worse than saying nothing.
  if (!team.ok && team.reason === "not_found") notFound();

  if (!team.ok) {
    return (
      <Section>
        <UnavailableState what="This team's page" />
      </Section>
    );
  }

  const [teams, squad, staff, articles] = await Promise.all([
    getTeams(),
    getSquad(slug),
    getStaff(slug),
    getTeamArticles(slug),
  ]);

  const accent = toTeamAccentKey(team.data.accent_key);

  return (
    <div data-team={accent}>
      <TeamHero team={team.data} />
      {teams.ok ? <TeamSwitcher teams={teams.data} currentSlug={slug} /> : null}

      <Section tone="turf">
        <SectionHeading label="Match centre" title="Next and latest" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {team.data.next_fixture ? (
            <div>
              <p className="mb-3 text-meta font-semibold uppercase tracking-widest text-accent-ink">
                Next match
              </p>
              <MatchCard fixture={team.data.next_fixture} />
            </div>
          ) : (
            <EmptyState title="No fixture announced">
              Kajiado County League fixtures will appear here once they are officially announced.
            </EmptyState>
          )}

          {team.data.latest_result ? (
            <div>
              <p className="mb-3 text-meta font-semibold uppercase tracking-widest text-accent-ink">
                Latest result
              </p>
              <MatchCard fixture={team.data.latest_result} />
            </div>
          ) : (
            <EmptyState title="No matches played yet">
              Results will appear here once the season begins.
            </EmptyState>
          )}
        </div>
      </Section>

      <Section>
        <SectionHeading label="Squad" title={`${team.data.short_name} squad`} />
        <div className="mt-8">
          <SquadGrid result={squad} />
        </div>
      </Section>

      <Section tone="turf">
        <SectionHeading label="Technical staff" title="Coaching and staff" />
        <div className="mt-8">
          {!staff.ok ? (
            <UnavailableState what="Staff information" />
          ) : staff.data.length === 0 ? (
            <EmptyState title="Staff to be announced">
              Coaching and technical staff will be listed here.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {staff.data.map((member) => (
                <li key={member.id}>
                  <StaffCard member={member} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {articles.ok && articles.data.length > 0 ? (
        <Section>
          <SectionHeading label="News" title={`${team.data.short_name} news`} />
          <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {articles.data.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
