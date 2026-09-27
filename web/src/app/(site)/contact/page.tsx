import type { Metadata } from "next";

import { ContactForm } from "@/components/forms/ContactForm";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getClub, getSocialLinks } from "@/lib/api";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Kitengela Marines.",
};

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};

export default async function ContactPage() {
  const [club, social] = await Promise.all([getClub(), getSocialLinks()]);
  const details = club.ok ? club.data : null;
  const links = social.ok ? social.data : [];

  return (
    <Section>
      <SectionHeading label="Contact" title="Get in touch" />

      <div className="mt-8 grid gap-12 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="max-w-2xl text-lg text-muted">
            Questions about joining, playing, or supporting the club are all welcome. Messages go
            to the club&rsquo;s own inbox.
          </p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>

        <aside>
          {details?.contact_phone || details?.contact_email || details?.home_ground ? (
            <div className="border border-line bg-chalk p-6">
              <h2 className="font-display text-xl font-extrabold uppercase">The club</h2>
              <dl className="mt-4 space-y-4">
                {details.contact_phone ? (
                  <div>
                    <dt className="text-meta text-muted">Phone</dt>
                    <dd className="font-semibold">
                      <a
                        href={`tel:${details.contact_phone.replace(/\s/g, "")}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {details.contact_phone}
                      </a>
                    </dd>
                  </div>
                ) : null}

                {details.contact_email ? (
                  <div>
                    <dt className="text-meta text-muted">Email</dt>
                    <dd className="font-semibold">
                      <a
                        href={`mailto:${details.contact_email}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {details.contact_email}
                      </a>
                    </dd>
                  </div>
                ) : null}

                {details.home_ground ? (
                  <div>
                    <dt className="text-meta text-muted">Home ground</dt>
                    <dd className="font-semibold">{details.home_ground}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          {links.length > 0 ? (
            <div className="mt-6 border border-line bg-chalk p-6">
              <h2 className="font-display text-xl font-extrabold uppercase">Follow the club</h2>
              <ul className="mt-4 space-y-2">
                {links.map((link) => (
                  <li key={link.platform}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent-ink underline-offset-4 hover:underline"
                    >
                      {PLATFORM_LABEL[link.platform] ?? link.platform}
                      {link.handle ? <span className="text-muted"> {link.handle}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </Section>
  );
}
