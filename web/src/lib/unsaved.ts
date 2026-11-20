/**
 * Whether a click on a link would take the editor away from this page within
 * the site, which is the navigation an unsaved-changes guard should question.
 *
 * Left alone: links opening a new tab or window, downloads, modified clicks
 * (the browser opens those elsewhere), other sites (the beforeunload prompt
 * covers those), and links that only move within this page.
 */
export function isLeavingWithinSite(
  link: { href: string; target?: string; download?: boolean },
  click: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  here: { origin: string; pathname: string; search: string },
): boolean {
  if (
    click.button !== 0 ||
    click.metaKey ||
    click.ctrlKey ||
    click.shiftKey ||
    click.altKey
  ) {
    return false;
  }
  if (link.download) return false;
  if (link.target && link.target !== "_self") return false;

  let destination: URL;
  try {
    destination = new URL(link.href, here.origin);
  } catch {
    return false;
  }
  if (destination.origin !== here.origin) return false;
  return (
    destination.pathname !== here.pathname || destination.search !== here.search
  );
}

export const LEAVE_WARNING =
  "You have changes that are not saved. Leave this page and lose them?";
