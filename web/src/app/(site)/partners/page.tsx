import type { Metadata } from "next";
import Image from "next/image";

import { PartnershipForm } from "@/components/forms/PartnershipForm";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getSponsors } from "@/lib/api";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Partner with Kitengela Marines: shirt and match sponsorship, kit, equipment and community partnerships.",
};

const OFFER = [
  ["Shirt sponsorship", "Your name on the shirts both teams play in, home and away."],
  ["Match sponsorship", "A named match day, with your name on the fixture and the report."],
  ["Training kit and equipment", "Balls, bibs, cones and training kit for two senior squads."],
  ["Community partnership", "Work with the club on what it does for young people in Kitengela."],
];

export default async function PartnersPage() {
  const sponsors = await getSponsors();
  const partners = sponsors.ok ? sponsors.data : [];

  return (
    <>
      <header className="bg-pitch text-chalk">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
            Partners
          </p>
          <h1 className="mt-3 font-display text-display font-black uppercase leading-none">
            Build with us
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-chalk/85">
            Kitengela Marines runs two senior teams on match-day logistics, training equipment and
            transport. Businesses and organisations who back the club put their name to football in
            Kitengela and to what it does for young people here.
          </p>
        </div>
      </header>

      {partners.length > 0 ? (
        <Section tone="turf">
          <SectionHeading label="Partners" title="Our partners" />
          <ul className="mt-8 flex flex-wrap items-center gap-10">
            {partners.map((sponsor) => (
              <li key={sponsor.slug}>
                {sponsor.logo ? (
                  <Image
                    src={sponsor.logo.url}
                    alt={sponsor.logo.alt}
                    width={200}
                    height={100}
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <span className="font-display text-2xl font-extrabold uppercase">
                    {sponsor.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section>
        <SectionHeading label="Partnership" title="Ways to support" />
        <ul className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2">
          {OFFER.map(([title, description]) => (
            <li key={title} className="bg-chalk p-6">
              <h3 className="font-display text-xl font-extrabold uppercase">{title}</h3>
              <p className="mt-2 text-muted">{description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="turf">
        <SectionHeading label="Partnership" title="Talk to the club" />
        <div className="mt-8 max-w-3xl">
          <PartnershipForm />
        </div>
      </Section>
    </>
  );
}
