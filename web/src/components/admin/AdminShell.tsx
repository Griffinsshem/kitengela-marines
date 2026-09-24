"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { useAuth } from "@/components/admin/AuthProvider";
import { cn } from "@/lib/cn";

/**
 * Chrome for the administration area, and the gate in front of it.
 *
 * The gate is for the person, not for the data: it keeps signed-out staff from
 * seeing an empty broken interface. Every request the pages make is checked
 * again by the API against capability and team scope, which is where access is
 * actually decided.
 *
 * Navigation is filtered by capability, so a Media Officer is not shown a
 * Fixtures link that would refuse them.
 */

type NavItem = { href: string; label: string; capability?: string };

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/news", label: "News", capability: "manage_news" },
  { href: "/admin/media", label: "Media", capability: "manage_media" },
  { href: "/admin/squad", label: "Squad", capability: "manage_squad" },
  { href: "/admin/fixtures", label: "Fixtures", capability: "manage_fixtures" },
  { href: "/admin/club", label: "Club settings", capability: "manage_club" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { status, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (status === "anonymous" && !isLoginPage) router.replace("/admin/login");
  }, [status, isLoginPage, router]);

  if (isLoginPage) return <main className="flex-1">{children}</main>;

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 items-center justify-center p-10">
        <p className="text-muted">
          {status === "loading" ? "Checking your session…" : "Redirecting…"}
        </p>
      </main>
    );
  }

  const items = NAV.filter(
    (item) => !item.capability || (user?.capabilities.includes(item.capability) ?? false),
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-4 border-accent bg-pitch text-chalk">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="font-display text-xl font-black uppercase leading-none">
              Kitengela Marines
            </p>
            <p className="text-meta text-chalk/60">Club administration</p>
          </div>
          <div className="flex items-center gap-4 text-meta">
            <span className="text-chalk/70">{user?.full_name}</span>
            <Link href="/" className="underline-offset-4 hover:underline">
              View site
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-control border border-chalk/30 px-3 py-1.5 font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav aria-label="Administration" className="mx-auto max-w-7xl px-5 sm:px-8">
          <ul className="flex flex-wrap gap-1 pb-1">
            {items.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-block border-b-4 px-3 py-2 font-semibold",
                      active
                        ? "border-accent-glow text-accent-glow"
                        : "border-transparent text-chalk/80 hover:text-chalk",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="content" className="flex-1 bg-turf">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
