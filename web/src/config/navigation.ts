/**
 * Site navigation.
 *
 * Structure is static; the Teams group is built from the API's team list, so
 * adding an academy side in the admin adds it to the menu with no code change,
 * and no team slug is hardcoded here.
 */

import type { Team } from "@/lib/schemas";

export type NavLink = { label: string; href: string };
export type NavGroup = { label: string; links: NavLink[] };
export type NavItem = NavLink | NavGroup;

export const SUPPORT_LINK: NavLink = { label: "Support the club", href: "/support" };

export function isNavGroup(item: NavItem): item is NavGroup {
  return "links" in item;
}

/** True for the page itself and anything nested beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isActiveItem(pathname: string, item: NavItem): boolean {
  return isNavGroup(item)
    ? item.links.some((link) => isActivePath(pathname, link.href))
    : isActivePath(pathname, item.href);
}

export function teamHref(team: Pick<Team, "slug">): string {
  return `/teams/${team.slug}`;
}

export function buildNavigation(teams: readonly Team[]): NavItem[] {
  // With no teams loaded (API down, or none entered yet) the group would be
  // empty, so it collapses to a plain link to the teams index instead.
  const teamsItem: NavItem =
    teams.length > 0
      ? { label: "Teams", links: teams.map((team) => ({ label: team.name, href: teamHref(team) })) }
      : { label: "Teams", href: "/teams" };

  return [
    {
      label: "Club",
      links: [
        { label: "About", href: "/club" },
        { label: "History", href: "/club/history" },
        { label: "Staff", href: "/club/staff" },
      ],
    },
    teamsItem,
    {
      label: "Matches",
      links: [
        { label: "Fixtures", href: "/fixtures" },
        { label: "Results", href: "/results" },
        { label: "League table", href: "/league-table" },
      ],
    },
    { label: "News", href: "/news" },
    {
      label: "Media",
      links: [
        { label: "Photos", href: "/media/photos" },
        { label: "Videos", href: "/media/videos" },
      ],
    },
    { label: "Partners", href: "/partners" },
    { label: "Contact", href: "/contact" },
  ];
}
