import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UnavailableState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { toTeamAccentKey } from "@/config/teams";
import { getArticle } from "@/lib/api";
import { formatDate } from "@/lib/datetime";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticle(slug);
  if (!result.ok) return { title: "News" };

  const article = result.data;
  return {
    title: article.title,
    description: article.summary ?? `${article.category.name} from Kitengela Marines.`,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary ?? undefined,
      publishedTime: article.published_at ?? undefined,
      // Gives the story a picture when a supporter shares it on WhatsApp,
      // which is where most of this club's links will travel.
      images: article.featured_image
        ? [{ url: article.featured_image.url, alt: article.featured_image.alt }]
        : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const result = await getArticle(slug);

  if (!result.ok && result.reason === "not_found") notFound();
  if (!result.ok) {
    return (
      <Section>
        <UnavailableState what="This article" />
      </Section>
    );
  }

  const article = result.data;
  const published = formatDate(article.published_at);
  const accent = article.team ? toTeamAccentKey(article.team.accent_key) : "club";

  return (
    <article data-team={accent}>
      <header className="bg-pitch text-chalk">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
            {article.category.name}
          </p>
          <h1 className="mt-3 font-display text-headline font-black uppercase leading-tight">
            {article.title}
          </h1>
          {article.summary ? (
            <p className="mt-5 text-lg text-chalk/85">{article.summary}</p>
          ) : null}
          <p className="mt-6 text-meta text-chalk/60">
            {article.author}
            {published ? ` — ${published}` : ""}
          </p>
        </div>
      </header>

      {article.featured_image ? (
        <div className="relative mx-auto aspect-[16/9] max-w-5xl">
          <Image
            src={article.featured_image.url}
            alt={article.featured_image.alt}
            fill
            priority
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <Section>
        <div className="mx-auto max-w-3xl">
          {/*
            The API sanitises this HTML on save and again on read, against a
            small allow-list with no scripts, no event handlers and no
            javascript: URLs. This is the one place the site renders markup it
            did not write, and it is trusted because of that two-pass
            sanitisation, not because an editor is assumed careful.
          */}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.body_html }} />

          <footer className="mt-12 flex flex-wrap gap-4 border-t border-line pt-6 text-meta">
            {article.team ? (
              <Link
                href={`/teams/${article.team.slug}`}
                className="font-semibold text-accent-ink underline-offset-4 hover:underline"
              >
                {article.team.name}
              </Link>
            ) : null}
            {article.fixture ? (
              <Link
                href={`/matches/${article.fixture.slug}`}
                className="font-semibold text-accent-ink underline-offset-4 hover:underline"
              >
                Match details
              </Link>
            ) : null}
            <Link href="/news" className="font-semibold underline-offset-4 hover:underline">
              All news
            </Link>
          </footer>
        </div>
      </Section>
    </article>
  );
}
