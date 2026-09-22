import Link from "next/link";

import { type NavLink, SUPPORT_LINK, buildNavigation, isNavGroup } from "@/config/navigation";
import { getClub, getTeams } from "@/lib/api";

import { ClubMark } from "./ClubMark";

// Read once at module load rather than during render, which keeps the
// component pure. Pages are rebuilt far more often than the year changes.
const YEAR = new Date().getFullYear();

/**
 * Site footer.
 *
 * Contact details render only when the club has entered them. No placeholder
 * phone number or address is shown in the meantime.
 */
export async function SiteFooter() {
  const [teamsResult, clubResult] = await Promise.all([getTeams(), getClub()]);
  const items = buildNavigation(teamsResult.ok ? teamsResult.data : []);
  const club = clubResult.ok ? clubResult.data : null;

  const groups = items.filter(isNavGroup);
  const singles = [
    ...items.filter((item): item is NavLink => !isNavGroup(item)),
    SUPPORT_LINK,
  ];

  const hasContact = Boolean(club?.home_ground || club?.contact_email || club?.contact_phone);

  return (
    <footer className="border-t-4 border-accent bg-pitch text-chalk">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <ClubMark className="text-3xl" />
            <p className="mt-4 max-w-xs text-chalk/75">
              Football club from Kitengela, Kajiado County. Home of Kitengela Marines and Marines
              Starlets.
            </p>

            {club && hasContact && (
              <dl className="mt-6 space-y-3 text-meta">
                {club.home_ground && (
                  <div>
                    <dt className="text-chalk/60">Home ground</dt>
                    <dd className="font-semibold">{club.home_ground}</dd>
                  </div>
                )}
                {club.contact_email && (
                  <div>
                    <dt className="text-chalk/60">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${club.contact_email}`}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {club.contact_email}
                      </a>
                    </dd>
                  </div>
                )}
                {club.contact_phone && (
                  <div>
                    <dt className="text-chalk/60">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${club.contact_phone.replace(/\s+/g, "")}`}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {club.contact_phone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

            <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="font-display text-lg font-extrabold uppercase text-accent-glow">
                  {group.label}
                </p>
                <FooterLinks links={group.links} />
              </div>
            ))}
            <div>
              <p className="font-display text-lg font-extrabold uppercase text-accent-glow">More</p>
              <FooterLinks links={singles} />
            </div>
          </nav>
        </div>

        <p className="mt-12 border-t border-chalk/15 pt-6 text-meta text-chalk/70">
          © {YEAR} Kitengela Marines. Official website.
        </p>
      </div>
    </footer>
  );
}

function FooterLinks({ links }: { links: NavLink[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-chalk/85 underline-offset-4 hover:text-chalk hover:underline">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
