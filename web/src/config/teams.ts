/**
 * Accent keys, matching Team.accent_key in the API. They are declared once so
 * no component hardcodes a team string, and anything the API sends that is not
 * listed here falls back to the club scope rather than rendering unstyled.
 */
export const TEAM_ACCENT_KEYS = ["club", "marines-men", "starlets"] as const;

export type TeamAccentKey = (typeof TEAM_ACCENT_KEYS)[number];

export function toTeamAccentKey(value: string | null | undefined): TeamAccentKey {
  return (TEAM_ACCENT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as TeamAccentKey)
    : "club";
}
