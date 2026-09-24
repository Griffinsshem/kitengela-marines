"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/admin/AuthProvider";

/**
 * The dashboard.
 *
 * Counts of things the club actually acts on, and nothing else. A chart of
 * page views would look impressive and tell a Media Officer nothing about what
 * to do next.
 *
 * Every figure links to the page where that work happens, and a figure that
 * could not be loaded says so rather than showing a misleading zero.
 */

type Summary = {
  drafts: number | null;
  published: number | null;
  media: number | null;
  fixtures: number | null;
  results: number | null;
};

const EMPTY: Summary = {
  drafts: null,
  published: null,
  media: null,
  fixtures: null,
  results: null,
};

export default function AdminDashboard() {
  const { user, authFetch } = useAuth();
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const total = useCallback(
    async (path: string): Promise<number | null> => {
      try {
        const response = await authFetch(path);
        if (!response.ok) return null;
        const body: unknown = await response.json();
        const meta = (body as { meta?: { total?: number } }).meta;
        return typeof meta?.total === "number" ? meta.total : null;
      } catch {
        return null;
      }
    },
    [authFetch],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [drafts, published, media, fixtures, results] = await Promise.all([
        total("/admin/articles?status=draft&per_page=1"),
        total("/admin/articles?status=published&per_page=1"),
        total("/admin/media/assets?per_page=1"),
        total("/fixtures?per_page=1"),
        total("/results?per_page=1"),
      ]);

      if (cancelled) return;
      setSummary({ drafts, published, media, fixtures, results });
      setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [total]);

  const cards = [
    { label: "Draft articles", value: summary.drafts, href: "/admin/news", capability: "manage_news" },
    { label: "Published articles", value: summary.published, href: "/admin/news", capability: "manage_news" },
    { label: "Media assets", value: summary.media, href: "/admin/media", capability: "manage_media" },
    { label: "Upcoming fixtures", value: summary.fixtures, href: "/admin/fixtures", capability: "manage_fixtures" },
    { label: "Results recorded", value: summary.results, href: "/admin/fixtures", capability: "manage_fixtures" },
  ].filter((card) => user?.capabilities.includes(card.capability) ?? false);

  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">
        Welcome, {user?.full_name}
      </h1>
      <p className="mt-2 capitalize text-muted">
        {user?.roles.map((role) => role.replace(/_/g, " ")).join(", ")}
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="block border border-line bg-chalk p-5 transition hover:border-accent-ink"
            >
              <p className="text-meta font-semibold text-muted">{card.label}</p>
              <p className="mt-2 font-display text-4xl font-black tabular-nums">
                {!loaded ? "—" : (card.value ?? "—")}
              </p>
              {loaded && card.value === null ? (
                <p className="mt-1 text-meta text-muted">Could not be loaded</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12 border border-line bg-chalk p-6">
        <h2 className="font-display text-xl font-extrabold uppercase">Getting started</h2>
        <p className="mt-3 max-w-2xl text-muted">
          The public site fills in as this information is entered. Squads, fixtures and news each
          appear on the site as soon as they are published here.
        </p>
      </section>
    </div>
  );
}
