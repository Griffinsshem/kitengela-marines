import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { TeamAccentKey } from "@/config/teams";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

type Source = "Specified" | "Sampled" | "Derived" | "Provisional" | "Assumed";

type Swatch = {
  name: string;
  className: string;
  hex: string;
  source: Source;
  note: string;
};

// Mirrors globals.css for reference. The swatch itself renders from the real
// CSS class, so a colour change shows up here even if this label lags.
const GROUPS: { title: string; swatches: Swatch[] }[] = [
  {
    title: "Club neutrals",
    swatches: [
      { name: "Pitch", className: "bg-pitch", hex: "#011E0F", source: "Derived", note: "Dark surfaces and body text. Home green darkened to near-black." },
      { name: "Chalk", className: "bg-chalk", hex: "#FFFFFF", source: "Specified", note: "Page surface." },
      { name: "Turf", className: "bg-turf", hex: "#EEF3F0", source: "Derived", note: "Alternate light surface." },
      { name: "Line", className: "bg-line", hex: "#D5DED8", source: "Derived", note: "Borders and rules." },
      { name: "Muted", className: "bg-muted", hex: "#4F6459", source: "Derived", note: "Secondary text, 6.4:1 on chalk." },
    ],
  },
  {
    title: "Marines Men",
    swatches: [
      { name: "Home green", className: "bg-men-green", hex: "#03994B", source: "Sampled", note: "Patterned kit. Fill only; white text on it at display size only (3.7:1)." },
      { name: "Bright green", className: "bg-men-green-bright", hex: "#03CA29", source: "Sampled", note: "Solid green kit. On pitch only (8.9:1)." },
      { name: "Green ink", className: "bg-men-green-ink", hex: "#02783B", source: "Derived", note: "Green text and buttons on chalk (5.6:1). Not a kit colour." },
      { name: "Yellow", className: "bg-men-yellow", hex: "#F1B40F", source: "Sampled", note: "CTAs and active states with pitch text (8.6:1). Never text on chalk." },
      { name: "Gold", className: "bg-men-gold", hex: "#C7A84A", source: "Specified", note: "Accents on pitch (7.7:1). Decorative only on chalk." },
    ],
  },
  {
    title: "Marines Starlets",
    swatches: [
      { name: "Blue", className: "bg-starlets-blue", hex: "#4A5BAB", source: "Sampled", note: "Accent and text on chalk (6.2:1). White text on it passes." },
      { name: "Blue glow", className: "bg-starlets-blue-glow", hex: "#949FD1", source: "Derived", note: "Blue text on pitch (6.2:1)." },
      { name: "Pink", className: "bg-starlets-pink", hex: "#EB8AE7", source: "Provisional", note: "From an edited photo and likely too magenta. Needs a clean photo." },
      { name: "Black", className: "bg-starlets-black", hex: "#000000", source: "Assumed", note: "Shorts. The photo sample carried a blue cast." },
    ],
  },
];

const TEAMS: { key: TeamAccentKey; name: string }[] = [
  { key: "marines-men", name: "Kitengela Marines" },
  { key: "starlets", name: "Marines Starlets" },
];

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <h1 className="font-display text-headline font-extrabold uppercase">Design system</h1>
      <p className="mt-3 max-w-prose text-muted">
        Development reference. Compare these swatches against the kit photos; this page is not
        served in production.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-12" aria-labelledby={`group-${group.title}`}>
          <h2 id={`group-${group.title}`} className="text-lg font-semibold">
            {group.title}
          </h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.swatches.map((swatch) => (
              <li key={swatch.name} className="flex gap-4 border-t border-line pt-4">
                <span aria-hidden="true" className={cn("size-14 shrink-0 ring-1 ring-line", swatch.className)} />
                <div>
                  <p className="font-semibold">{swatch.name}</p>
                  <p className="text-meta tabular-nums text-muted">{swatch.hex}</p>
                  <p
                    className={cn(
                      "text-meta font-semibold",
                      swatch.source === "Provisional" || swatch.source === "Assumed"
                        ? "text-pitch underline decoration-men-yellow decoration-2 underline-offset-2"
                        : "text-muted",
                    )}
                  >
                    {swatch.source}
                  </p>
                  <p className="mt-1 text-meta">{swatch.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-16" aria-labelledby="type-heading">
        <h2 id="type-heading" className="text-lg font-semibold">
          Type
        </h2>
        <div className="mt-6 space-y-8 border-t border-line pt-6">
          <p className="font-display text-display font-black uppercase">Kitengela Marines</p>
          <p className="font-display text-headline font-extrabold uppercase">Marines Starlets</p>
          <p className="font-display text-score font-black tabular-nums">0123456789</p>
          <p className="max-w-prose text-lg leading-relaxed">
            Body text is Barlow at comfortable reading size. Articles, fixtures, forms and
            navigation all use it, with line lengths kept under eighty characters.
          </p>
          <p className="text-meta text-muted">Kajiado County League</p>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="teams-heading">
        <h2 id="teams-heading" className="text-lg font-semibold">
          Team scopes
        </h2>
        <p className="mt-2 max-w-prose text-muted">
          Identical markup in both panels. Only the data-team attribute differs.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {TEAMS.map((team) => (
            <div key={team.key} data-team={team.key} className="ring-1 ring-line">
              <div className="bg-pitch px-5 py-6">
                <p className="font-display text-headline font-extrabold uppercase text-chalk">
                  {team.name}
                </p>
                <p className="mt-2 font-semibold text-accent-glow">Accent on pitch</p>
                <span className="mt-4 inline-block rounded-control bg-highlight px-4 py-2 font-semibold text-on-highlight">
                  Highlight
                </span>
              </div>
              <div aria-hidden="true" className="h-2 bg-accent" />
              <div className="bg-chalk px-5 py-6">
                <p className="font-semibold text-accent-ink">Accent on chalk</p>
                <button
                  type="button"
                  className="mt-4 rounded-control bg-accent-ink px-4 py-2 font-semibold text-chalk"
                >
                  Primary action
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
