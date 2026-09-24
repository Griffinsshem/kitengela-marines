/**
 * Browser-side session helpers.
 *
 * The admin area talks to the API from the browser with the signed-in user's
 * token, so the Next server never holds anyone's credentials and there is no
 * server-side session store to keep.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(
  /\/$/,
  "",
);

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  capabilities: string[];
};

/**
 * The refresh cookie is HttpOnly and unreadable here, which is the point. The
 * API also sets a readable CSRF cookie whose value must be echoed in a header:
 * a page on another origin can cause the browser to send the cookie, but
 * cannot read it, so it cannot produce the matching header.
 */
export function readCsrfToken(name = "csrf_refresh_token"): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function requestAccessToken(): Promise<string | null> {
  const csrf = readCsrfToken();
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    // Sends the HttpOnly refresh cookie. Without this the browser omits it on
    // a cross-origin request.
    credentials: "include",
    headers: csrf ? { "X-CSRF-TOKEN": csrf } : {},
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  const token = (body as { access_token?: string }).access_token;
  return typeof token === "string" ? token : null;
}

export async function fetchCurrentUser(token: string): Promise<SessionUser | null> {
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  return (body as { user?: SessionUser }).user ?? null;
}

export function hasCapability(user: SessionUser | null, capability: string): boolean {
  return user?.capabilities.includes(capability) ?? false;
}
