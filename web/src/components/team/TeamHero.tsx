import type { CSSProperties } from "react";

import { RisingWords } from "@/components/ui/RisingWords";
import type { TeamDetail } from "@/lib/schemas";

const GENDER_LABEL: Record<string, string> = {
  men: "Men's team",
  women: "Women's team",
  mixed: "Mixed team",
};

const CATEGORY_LABEL: Record<string, string> = {
  senior: "Senior",
  development: "Development",
  academy: "Academy",
  youth: "Youth",
};

/**
 * A team's own header. The accent comes from the data-team scope set by the
 * page, so the same component gives the men's side green and Starlets blue.
 *
 * Enters the same way as the homepage hero, so moving between teams feels like
 * one broadcast cutting to its next title card.
 */
export function TeamHero({ team }: { team: TeamDetail }) {
  const descriptor = [CATEGORY_LABEL[team.category], GENDER_LABEL[team.gender]]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="bg-pitch text-chalk">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div aria-hidden="true" className="entrance-bar flex h-1.5 w-28">
          <span className="flex-1 bg-accent" />
        </div>
        {descriptor ? (
          <p
            className="entrance-fade mt-5 text-meta font-semibold uppercase tracking-widest text-accent-glow"
            style={{ "--i": -4 } as CSSProperties}
          >
            {descriptor}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-display font-black uppercase">
          <RisingWords text={team.name} />
        </h1>
        {team.summary ? (
          <p className="entrance-fade mt-5 max-w-2xl text-lg text-chalk/85">{team.summary}</p>
        ) : null}
      </div>
    </section>
  );
}
