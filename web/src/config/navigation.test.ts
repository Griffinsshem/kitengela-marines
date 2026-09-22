import { describe, expect, it } from "vitest";

import { buildNavigation, isActiveItem, isActivePath, isNavGroup } from "@/config/navigation";
import { toTeamAccentKey } from "@/config/teams";
import type { Team } from "@/lib/schemas";

const team = (overrides: Partial<Team>): Team => ({
  id: "00000000-0000-0000-0000-000000000000",
  name: "Team",
  short_name: "Team",
  slug: "team",
  category: "senior",
  gender: "men",
  accent_key: "club",
  summary: null,
  ...overrides,
});

describe("buildNavigation", () => {
  it("builds the Teams group from the API's teams", () => {
    const nav = buildNavigation([
      team({ name: "Kitengela Marines", slug: "marines-men" }),
      team({ name: "Marines Starlets", slug: "starlets" }),
    ]);
    const teams = nav.find((item) => item.label === "Teams");

    expect(teams && isNavGroup(teams) && teams.links).toEqual([
      { label: "Kitengela Marines", href: "/teams/marines-men" },
      { label: "Marines Starlets", href: "/teams/starlets" },
    ]);
  });

  it("collapses Teams to a plain link when no teams are available", () => {
    const teams = buildNavigation([]).find((item) => item.label === "Teams");

    expect(teams).toEqual({ label: "Teams", href: "/teams" });
  });
});

describe("active state", () => {
  it("marks nested pages as active", () => {
    expect(isActivePath("/club/history", "/club")).toBe(true);
    expect(isActivePath("/clubhouse", "/club")).toBe(false);
  });

  it("does not treat the home link as a prefix of every page", () => {
    expect(isActivePath("/news", "/")).toBe(false);
    expect(isActivePath("/", "/")).toBe(true);
  });

  it("marks a group active when one of its links is", () => {
    const matches = buildNavigation([]).find((item) => item.label === "Matches");
    expect(matches && isActiveItem("/results", matches)).toBe(true);
  });
});

describe("toTeamAccentKey", () => {
  it("accepts known keys and falls back to the club scope", () => {
    expect(toTeamAccentKey("starlets")).toBe("starlets");
    expect(toTeamAccentKey("u17")).toBe("club");
    expect(toTeamAccentKey(null)).toBe("club");
  });
});
