/**
 * Server-side client for the Flask API.
 *
 * Every call returns an ApiResult rather than throwing. The distinction that
 * matters is between "the club has no fixtures" (ok, empty) and "the API could
 * not be reached" (not ok). Treating an outage as empty data would tell
 * supporters that no fixtures exist when they simply failed to load — a false
 * statement on an official club site.
 */

import type { z } from "zod";

import {
  type ArticleSummary,
  type Club,
  type Fixture,
  type GallerySummary,
  type SeasonRef,
  type Sponsor,
  type Standing,
  type PlayerDetail,
  type Squad,
  type StaffMember,
  type Team,
  type TeamDetail,
  articlesResponseSchema,
  clubResponseSchema,
  fixturesResponseSchema,
  galleriesResponseSchema,
  sponsorsResponseSchema,
  playerDetailResponseSchema,
  squadResponseSchema,
  staffResponseSchema,
  standingsResponseSchema,
  teamDetailResponseSchema,
  teamsResponseSchema,
} from "@/lib/schemas";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

// A slow API must not hold a page render hostage.
const TIMEOUT_MS = 5000;

export type FailureReason = "not_found" | "unavailable";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: FailureReason };

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  revalidateSeconds: number,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) {
      // Not an error: the thing asked for does not exist.
      return { ok: false, reason: "not_found" };
    }

    if (!response.ok) {
      console.error(`API ${path} responded ${response.status}`);
      return { ok: false, reason: "unavailable" };
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      console.error(`API ${path} returned an unexpected shape`, parsed.error.issues);
      return { ok: false, reason: "unavailable" };
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    // Log the reason, not the stack: during a build without the API running
    // this fires on every page and a full trace per page is noise.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`API ${path} unreachable: ${reason}`);
    return { ok: false, reason: "unavailable" };
  }
}

export async function getTeams(): Promise<ApiResult<Team[]>> {
  const result = await request("/teams", teamsResponseSchema, 300);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getClub(): Promise<ApiResult<Club | null>> {
  const result = await request("/club", clubResponseSchema, 300);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

/**
 * Match data changes on match day and is cached for a minute, so a result
 * entered at full time reaches supporters while the edge still absorbs the
 * traffic a result brings.
 */
export async function getNextFixture(): Promise<ApiResult<Fixture | null>> {
  const result = await request("/fixtures?per_page=1", fixturesResponseSchema, 60);
  return result.ok ? { ok: true, data: result.data.data[0] ?? null } : result;
}

export async function getLatestResult(): Promise<ApiResult<Fixture | null>> {
  const result = await request("/results?per_page=1", fixturesResponseSchema, 60);
  return result.ok ? { ok: true, data: result.data.data[0] ?? null } : result;
}

export async function getLatestArticles(limit = 3): Promise<ApiResult<ArticleSummary[]>> {
  const result = await request(`/articles?per_page=${limit}`, articlesResponseSchema, 60);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getStandings(): Promise<
  ApiResult<{ rows: Standing[]; season: SeasonRef | null }>
> {
  const result = await request("/standings", standingsResponseSchema, 60);
  return result.ok
    ? { ok: true, data: { rows: result.data.data, season: result.data.meta.season } }
    : result;
}

export async function getLatestGalleries(limit = 4): Promise<ApiResult<GallerySummary[]>> {
  const result = await request(`/galleries?per_page=${limit}`, galleriesResponseSchema, 300);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getSponsors(): Promise<ApiResult<Sponsor[]>> {
  const result = await request("/sponsors", sponsorsResponseSchema, 600);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getTeam(slug: string): Promise<ApiResult<TeamDetail>> {
  const result = await request(`/teams/${slug}`, teamDetailResponseSchema, 120);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getSquad(
  teamSlug: string,
): Promise<ApiResult<{ squad: Squad; total: number }>> {
  const result = await request(`/teams/${teamSlug}/players`, squadResponseSchema, 300);
  return result.ok
    ? { ok: true, data: { squad: result.data.data, total: result.data.meta.total } }
    : result;
}

export async function getPlayer(
  teamSlug: string,
  playerSlug: string,
): Promise<ApiResult<PlayerDetail>> {
  const result = await request(
    `/teams/${teamSlug}/players/${playerSlug}`,
    playerDetailResponseSchema,
    300,
  );
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getStaff(teamSlug?: string): Promise<ApiResult<StaffMember[]>> {
  const path = teamSlug ? `/staff?team=${teamSlug}` : "/staff";
  const result = await request(path, staffResponseSchema, 300);
  return result.ok ? { ok: true, data: result.data.data } : result;
}

export async function getTeamArticles(
  teamSlug: string,
  limit = 3,
): Promise<ApiResult<ArticleSummary[]>> {
  const result = await request(
    `/articles?team=${teamSlug}&per_page=${limit}`,
    articlesResponseSchema,
    60,
  );
  return result.ok ? { ok: true, data: result.data.data } : result;
}

