import Image from "next/image";
import Link from "next/link";

import { formatDate } from "@/lib/datetime";
import type { ArticleSummary } from "@/lib/schemas";
import { cn } from "@/lib/cn";

/**
 * A story, in one of two sizes.
 *
 * The lead story gets the space; the rest are a list. Uniform cards would
 * flatten the difference between the week's main story and a short notice,
 * which is the first thing a news section should communicate.
 *
 * Articles without a picture get no placeholder. They fall back to a
 * typographic treatment, which reads as deliberate rather than broken.
 */
export function NewsCard({
  article,
  variant = "compact",
}: {
  article: ArticleSummary;
  variant?: "lead" | "compact";
}) {
  const lead = variant === "lead";
  const published = formatDate(article.published_at);

  return (
    <article className={cn("group", lead && "sm:col-span-2")}>
      <Link href={`/news/${article.slug}`} className="block">
        {article.featured_image ? (
          <div
            className={cn(
              "relative overflow-hidden bg-turf",
              lead ? "aspect-[16/9]" : "aspect-[4/3]",
            )}
          >
            <Image
              src={article.featured_image.url}
              alt={article.featured_image.alt}
              fill
              // Lead spans two columns on tablet and up; the rest are thirds.
              sizes={lead ? "(min-width: 640px) 66vw, 100vw" : "(min-width: 640px) 33vw, 100vw"}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <div aria-hidden="true" className={cn("bg-accent", lead ? "h-2" : "h-1.5")} />
        )}

        <p className="mt-4 text-meta font-semibold text-accent-ink">{article.category.name}</p>
        <h3
          className={cn(
            "mt-1 font-display font-extrabold uppercase leading-tight underline-offset-4 group-hover:underline",
            lead ? "text-headline" : "text-xl",
          )}
        >
          {article.title}
        </h3>
        {article.summary ? (
          <p className={cn("mt-2 text-muted", lead ? "max-w-2xl text-lg" : "line-clamp-3")}>
            {article.summary}
          </p>
        ) : null}
        {published ? <p className="mt-3 text-meta text-muted">{published}</p> : null}
      </Link>
    </article>
  );
}
