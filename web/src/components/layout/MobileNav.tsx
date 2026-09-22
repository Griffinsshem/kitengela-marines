"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  type NavItem,
  SUPPORT_LINK,
  isActivePath,
  isNavGroup,
  teamHref,
} from "@/config/navigation";
import { toTeamAccentKey } from "@/config/teams";
import type { Team } from "@/lib/schemas";

import { ClubMark } from "./ClubMark";

/**
 * Full-screen mobile menu.
 *
 * Built on the native modal <dialog>: showModal() traps focus inside, makes
 * the page behind inert to assistive technology, closes on Escape and returns
 * focus to the Menu button — accessibility behaviour that a hand-rolled overlay
 * has to reimplement and usually gets partly wrong.
 *
 * The teams open the menu as two colour blocks in their own kit colours, since
 * choosing a team is the most common reason a supporter opens it.
 */
export function MobileNav({ items, teams }: { items: NavItem[]; teams: Team[] }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Close whenever the route changes, e.g. after following a link.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // The team blocks replace the Teams group; keep it only as the fallback link
  // when no teams are available.
  const listItems = teams.length > 0 ? items.filter((item) => item.label !== "Teams") : items;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-control px-3 py-2 font-semibold text-chalk xl:hidden"
      >
        <List aria-hidden="true" weight="bold" className="size-5" />
        Menu
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Site menu"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-pitch p-0 text-chalk backdrop:bg-pitch"
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex h-16 shrink-0 items-center justify-between border-b-4 border-accent px-5">
            <ClubMark className="text-2xl" />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex items-center gap-2 rounded-control px-3 py-2 font-semibold"
            >
              <X aria-hidden="true" weight="bold" className="size-5" />
              Close
            </button>
          </div>

          {teams.length > 0 && (
            <ul className="grid grid-cols-2 gap-px bg-pitch">
              {teams.map((team) => (
                <li key={team.id} data-team={toTeamAccentKey(team.accent_key)}>
                  <Link
                    href={teamHref(team)}
                    aria-current={isActivePath(pathname, teamHref(team)) ? "page" : undefined}
                    className="flex min-h-28 flex-col justify-end bg-accent p-4 font-display text-2xl font-black uppercase leading-none text-chalk aria-[current=page]:underline"
                  >
                    {team.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <nav aria-label="Main" className="flex-1 px-5 pb-8">
            <ul>
              <li>
                <MobileLink href="/" label="Home" current={pathname === "/"} />
              </li>
              {listItems.map((item) =>
                isNavGroup(item) ? (
                  <li key={item.label} className="border-t border-chalk/15 pt-5">
                    <p className="font-display text-lg font-extrabold uppercase text-accent-glow">
                      {item.label}
                    </p>
                    <ul className="mt-1 pb-3">
                      {item.links.map((link) => (
                        <li key={link.href}>
                          <MobileLink
                            href={link.href}
                            label={link.label}
                            current={isActivePath(pathname, link.href)}
                          />
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={item.label} className="border-t border-chalk/15">
                    <MobileLink
                      href={item.href}
                      label={item.label}
                      current={isActivePath(pathname, item.href)}
                    />
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="sticky bottom-0 shrink-0 bg-pitch px-5 pb-6 pt-3">
            <Link
              href={SUPPORT_LINK.href}
              className="block rounded-control bg-highlight px-4 py-3.5 text-center font-semibold text-on-highlight"
            >
              {SUPPORT_LINK.label}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}

function MobileLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  // 48px minimum height: comfortably above the 44px touch-target guidance.
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="flex min-h-12 items-center text-xl font-semibold decoration-accent-glow decoration-2 underline-offset-4 aria-[current=page]:underline"
    >
      {label}
    </Link>
  );
}
