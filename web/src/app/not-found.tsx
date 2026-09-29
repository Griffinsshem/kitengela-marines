import Link from "next/link";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";

/**
 * A page that does not exist.
 *
 * Carries its own header and footer because Next renders this outside the
 * public site's layout, and a club's 404 should still look like the club's
 * site rather than a bare framework page.
 *
 * The links are the useful part: somebody who mistyped a player's name wants
 * the squad, not an apology.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="flex-1">
        <section className="bg-pitch text-chalk">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-28">
            <div aria-hidden="true" className="mx-auto flex h-1.5 w-28 overflow-hidden">
              <span className="flex-1 bg-men-green" />
              <span className="flex-1 bg-men-yellow" />
              <span className="flex-1 bg-men-gold" />
            </div>

            <p className="mt-6 font-display text-display font-black uppercase leading-none">404</p>
            <h1 className="mt-4 font-display text-headline font-extrabold uppercase">
              Page not found
            </h1>
            <p className="mt-4 text-lg text-chalk/80">
              That page has moved or never existed. Everything else is where it was.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/" variant="highlight">
                Home
              </ButtonLink>
              <ButtonLink href="/fixtures" variant="outline">
                Fixtures
              </ButtonLink>
              <ButtonLink href="/news" variant="outline">
                News
              </ButtonLink>
            </div>

            <p className="mt-10 text-meta text-chalk/60">
              Looking for a squad?{" "}
              <Link
                href="/teams"
                className="font-semibold text-accent-glow underline-offset-4 hover:underline"
              >
                Our teams
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
