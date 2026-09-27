import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getClub, getSupportMethods } from "@/lib/api";
import type { SupportMethod } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Support the club",
  description: "Ways to support Kitengela Marines and Marines Starlets.",
};

const KIND_LABEL: Record<string, string> = {
  mpesa_paybill: "M-Pesa paybill",
  mpesa_till: "M-Pesa till",
  mpesa_send_money: "M-Pesa",
  bank_transfer: "Bank transfer",
  in_kind: "In kind",
  other: "Other",
};

/**
 * Ways to give.
 *
 * Only methods the club has published appear. Until it publishes any, the page
 * says plainly what the money is for and points at the contact form, rather
 * than showing payment details nobody has approved.
 */
export default async function SupportPage() {
  const [methods, club] = await Promise.all([getSupportMethods(), getClub()]);
  const phone = club.ok ? club.data?.contact_phone : null;

  return (
    <>
      <header className="bg-pitch text-chalk">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">
            Support
          </p>
          <h1 className="mt-3 font-display text-display font-black uppercase leading-none">
            Back the Marines
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-chalk/85">
            Transport to away matches, training equipment, kit and match-day costs are what keep
            two senior teams on the pitch. Anything supporters can give goes to that.
          </p>
        </div>
      </header>

      <Section>
        <SectionHeading label="Support" title="Ways to give" />
        <div className="mt-8">
          {!methods.ok ? (
            <UnavailableState what="Ways to support the club" />
          ) : methods.data.length === 0 ? (
            <EmptyState
              title="Get in touch to support the club"
              action={
                <ButtonLink href="/contact" variant="highlight">
                  Contact the club
                </ButtonLink>
              }
            >
              The club is arranging how supporters can give. In the meantime, speak to the club
              directly{phone ? ` on ${phone}` : ""} and someone will help.
            </EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2">
              {methods.data.map((method) => (
                <li key={method.name}>
                  <SupportCard method={method} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </>
  );
}

function SupportCard({ method }: { method: SupportMethod }) {
  return (
    <article className="h-full border border-line bg-chalk p-6">
      <p className="text-meta font-semibold text-accent-ink">
        {KIND_LABEL[method.kind] ?? method.kind}
      </p>
      <h2 className="mt-1 font-display text-xl font-extrabold uppercase">{method.name}</h2>

      <dl className="mt-4 space-y-3">
        {method.account_value ? (
          <div>
            <dt className="text-meta text-muted">{method.account_label ?? "Number"}</dt>
            {/* Tabular figures: an account number is read digit by digit. */}
            <dd className="font-display text-2xl font-black tabular-nums">
              {method.account_value}
            </dd>
          </div>
        ) : null}

        {method.account_name ? (
          <div>
            <dt className="text-meta text-muted">Account name</dt>
            <dd className="font-semibold">{method.account_name}</dd>
          </div>
        ) : null}
      </dl>

      {method.instructions ? (
        <p className="mt-4 whitespace-pre-line text-muted">{method.instructions}</p>
      ) : null}
    </article>
  );
}
