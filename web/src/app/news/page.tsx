import type { Metadata } from "next";

import { Pagination } from "@/components/match/Pagination";
import { NewsCard } from "@/components/news/NewsCard";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { FilterLinks } from "@/components/ui/FilterLinks";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getArticleCategories, getArticles } from "@/lib/api";

export const metadata: Metadata = {
  title: "News",
  description: "Match reports, team news and announcements from Kitengela Marines.",
};

type Search = { searchParams: Promise<{ category?: string; page?: string }> };

export default async function NewsPage({ searchParams }: Search) {
  const { category, page } = await searchParams;
  const pageNumber = Number(page) > 0 ? Number(page) : 1;

  const [categories, articles] = await Promise.all([
    getArticleCategories(),
    getArticles({ category, page: pageNumber }),
  ]);

  // The lead story only leads the first unfiltered page. A lead three pages
  // deep would be a layout habit rather than an editorial statement.
  const isFirstPage = pageNumber === 1 && !category;
  const items = articles.ok ? articles.data.items : [];
  const [lead, ...rest] = isFirstPage ? items : [];

  return (
    <Section>
      <SectionHeading label="News" title="Club news" />

      {categories.ok ? (
        <div className="mt-6">
          <FilterLinks
            label="Filter by category"
            paramName="category"
            basePath="/news"
            current={category}
            options={[
              { label: "All news" },
              ...categories.data.map((item) => ({ value: item.slug, label: item.name })),
            ]}
          />
        </div>
      ) : null}

      <div className="mt-8">
        {!articles.ok ? (
          <UnavailableState what="Club news" />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing published yet">
            Match reports, team news and club announcements will be published here.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {isFirstPage ? (
                <>
                  {lead ? <NewsCard article={lead} variant="lead" /> : null}
                  {rest.map((article) => (
                    <NewsCard key={article.slug} article={article} />
                  ))}
                </>
              ) : (
                items.map((article) => <NewsCard key={article.slug} article={article} />)
              )}
            </div>
            <Pagination meta={articles.data.meta} basePath="/news" />
          </>
        )}
      </div>
    </Section>
  );
}
