import type { Metadata } from "next";
import Image from "next/image";

import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getStaff } from "@/lib/api";
import type { StaffMember } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Coaching and staff",
  description: "The people who run Kitengela Marines and Marines Starlets.",
};

const ROLE_LABEL: Record<string, string> = {
  head_coach: "Head coach",
  assistant_coach: "Assistant coach",
  goalkeeping_coach: "Goalkeeping coach",
  team_manager: "Team manager",
  physio: "Physio",
  treasurer: "Treasurer",
  official: "Club official",
};

// Coaching staff first, then the people who run the club off the pitch.
const ORDER = [
  "head_coach",
  "assistant_coach",
  "goalkeeping_coach",
  "team_manager",
  "physio",
  "treasurer",
  "official",
];

export default async function StaffPage() {
  const result = await getStaff();

  const sorted = result.ok
    ? [...result.data].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))
    : [];

  return (
    <Section>
      <SectionHeading label="The club" title="Coaching and staff" />

      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Club staff" />
        ) : sorted.length === 0 ? (
          <EmptyState title="Staff to be announced">
            Coaching and technical staff will be listed here.
          </EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((member) => (
              <li key={member.id}>
                <StaffProfile member={member} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function StaffProfile({ member }: { member: StaffMember }) {
  return (
    <article className="h-full border border-line bg-chalk">
      {member.photo_url ? (
        <div className="relative aspect-[4/3] bg-turf">
          <Image
            src={member.photo_url}
            alt={member.full_name}
            fill
            sizes="(min-width: 1024px) 30vw, 50vw"
            className="object-cover object-top"
          />
        </div>
      ) : (
        // No portrait: a rule in the club's colours rather than a grey
        // silhouette, which would read as something missing.
        <div aria-hidden="true" className="h-2 bg-accent" />
      )}

      <div className="p-5">
        <p className="text-meta font-semibold text-accent-ink">
          {ROLE_LABEL[member.role] ?? member.role}
        </p>
        <h2 className="mt-1 font-display text-xl font-extrabold uppercase leading-tight">
          {member.full_name}
        </h2>
        <p className="mt-1 text-meta text-muted">
          {member.team ? member.team.name : "Kitengela Marines"}
        </p>
        {member.biography ? <p className="mt-3 text-muted">{member.biography}</p> : null}
      </div>
    </article>
  );
}
