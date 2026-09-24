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
 */
export function TeamHero({ team }: { team: TeamDetail }) {
  const descriptor = [CATEGORY_LABEL[team.category], GENDER_LABEL[team.gender]]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="bg-pitch text-chalk">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div aria-hidden="true" className="h-1.5 w-28 bg-accent" />
        {descriptor ? (
          <p className="mt-5 text-meta font-semibold uppercase tracking-widest text-accent-glow">
            {descriptor}
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-display font-black uppercase">{team.name}</h1>
        {team.summary ? (
          <p className="mt-5 max-w-2xl text-lg text-chalk/85">{team.summary}</p>
        ) : null}
      </div>
    </section>
  );
}
