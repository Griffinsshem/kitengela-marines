import { NewsCard } from "@/components/news/NewsCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import type { ApiResult } from "@/lib/api";
import type { ArticleSummary } from "@/lib/schemas";

export function LatestNews({ result }: { result: ApiResult<ArticleSummary[]> }) {
  const articles = result.ok ? result.data : [];
  const [lead, ...rest] = articles;

  return (
    <Section>
      <SectionHeading
        label="News"
        title="Latest from the club"
        action={
          <ButtonLink href="/news" variant="outline">
            All news
          </ButtonLink>
        }
      />
      <div className="mt-8">
        {!result.ok ? (
          <UnavailableState what="Club news" />
        ) : articles.length === 0 ? (
          <EmptyState title="Stories coming soon">
            Match reports, team news and club announcements will be published here.
          </EmptyState>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {lead ? <NewsCard article={lead} variant="lead" /> : null}
            {rest.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
