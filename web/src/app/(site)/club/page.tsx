import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getClub, getTeams } from "@/lib/api";

export const metadata: Metadata = {
  title: "About the club",
  description:
    "Kitengela Marines: a football club from Kitengela, Kajiado County, home of Kitengela Marines and Marines Starlets.",
};

/**
 * About the club.
 *
 * Every section here is conditional on the club having entered something. A
 * section with nothing behind it is left out rather than shown as a gap, so
 * the page grows as the club fills it in and never looks unfinished.
 */
export default async function ClubPage() {
  const [club, teams] = await Promise.all([getClub(), getTeams()]);

  if (!club.ok) {
    return (
      <Section>
        <UnavailableState what="The club's details" />
      </Section>
    );
  }

  // Three states, not two: the request can fail, or succeed and find that
  // nothing has been entered yet. They need different words.
  const details = club.data;
  if (details === null) {
    return (
      <Section>
        <EmptyState title="About the club">
          The club&rsquo;s details will appear here once they have been entered.
        </EmptyState>
      </Section>
    );
  }

  const place = [details.town, details.county].filter(Boolean).join(", ");

  return (
    <>
      <header className="bg-pitch text-chalk">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div aria-hidden="true" className="flex h-1.5 w-40 overflow-hidden">
            <span className="flex-1 bg-men-green" />
            <span className="flex-1 bg-men-yellow" />
            <span className="flex-1 bg-men-gold" />
          </div>
          <h1 className="mt-6 font-display text-display font-black uppercase">{details.name}</h1>
          {place ? <p className="mt-4 text-lg font-semibold text-accent-glow">{place}</p> : null}
          {details.summary ? (
            <p className="mt-6 max-w-2xl font-display text-headline font-extrabold uppercase leading-tight">
              {details.summary}
            </p>
          ) : null}
        </div>
      </header>

      {details.mission ? (
        <Section>
          <SectionHeading label="The club" title="Our mission" />
          <p className="mt-8 max-w-3xl text-xl leading-relaxed">{details.mission}</p>
        </Section>
      ) : null}

      {details.values.length > 0 ? (
        <Section tone="turf">
          <SectionHeading label="The club" title="What we stand for" />
          <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {details.values.map((value) => (
              <li
                key={value}
                className="bg-chalk px-5 py-8 font-display text-2xl font-extrabold uppercase"
              >
                {value}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {teams.ok && teams.data.length > 0 ? (
        <Section>
          <SectionHeading label="The club" title="Our teams" />
          <ul className="mt-8 grid gap-6 md:grid-cols-2">
            {teams.data.map((team) => (
              <li key={team.id} data-team={team.accent_key}>
                <Link
                  href={`/teams/${team.slug}`}
                  className="group flex h-full min-h-40 flex-col justify-end bg-accent p-6 text-chalk transition hover:brightness-110"
                >
                  <p className="font-display text-headline font-black uppercase leading-none">
                    {team.name}
                  </p>
                  <p className="mt-3 font-semibold underline-offset-4 group-hover:underline">
                    Squad and fixtures
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {details.training_times.length > 0 ? (
        <Section tone="pitch">
          <div className="border-b border-chalk/20 pb-4">
            <p className="text-meta font-semibold text-accent-glow">Join us</p>
            <h2 className="mt-1 font-display text-headline font-extrabold uppercase">Training</h2>
          </div>

          <ul className="mt-8 grid gap-px border border-chalk/20 bg-chalk/20 sm:grid-cols-2">
            {details.training_times.map((session) => (
              <li key={session} className="bg-pitch px-5 py-6 text-lg font-semibold">
                {session}
              </li>
            ))}
          </ul>

          {details.home_ground ? (
            <p className="mt-6 text-chalk/80">
              Training and home matches are at {details.home_ground}.
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/contact" variant="highlight">
              Get in touch
            </ButtonLink>
            <ButtonLink href="/club/staff" variant="outline">
              Coaching and staff
            </ButtonLink>
          </div>
        </Section>
      ) : null}
    </>
  );
}
