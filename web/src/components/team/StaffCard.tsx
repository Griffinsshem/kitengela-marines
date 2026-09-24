import Image from "next/image";

import type { StaffMember } from "@/lib/schemas";

const ROLE_LABEL: Record<string, string> = {
  head_coach: "Head coach",
  assistant_coach: "Assistant coach",
  goalkeeping_coach: "Goalkeeping coach",
  team_manager: "Team manager",
  physio: "Physio",
  official: "Club official",
};

export function StaffCard({ member }: { member: StaffMember }) {
  return (
    <article className="flex gap-4 border border-line bg-chalk p-4">
      {member.photo_url ? (
        <Image
          src={member.photo_url}
          alt={member.full_name}
          width={96}
          height={96}
          className="size-24 shrink-0 object-cover object-top"
        />
      ) : null}
      <div>
        <p className="text-meta font-semibold text-accent-ink">
          {ROLE_LABEL[member.role] ?? member.role}
        </p>
        <h3 className="mt-1 font-display text-xl font-extrabold uppercase leading-tight">
          {member.full_name}
        </h3>
        {member.biography ? (
          <p className="mt-2 line-clamp-3 text-meta text-muted">{member.biography}</p>
        ) : null}
      </div>
    </article>
  );
}
