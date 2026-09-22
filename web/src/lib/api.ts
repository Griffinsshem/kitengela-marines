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
  type Club,
  type Team,
  clubResponseSchema,
  teamsResponseSchema,
} from "@/lib/schemas";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

// A slow API must not hold a page render hostage.
const TIMEOUT_MS = 5000;

export type ApiResult<T> = { ok: true; data: T } | { ok: false };

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

    if (!response.ok) {
      console.error(`API ${path} responded ${response.status}`);
      return { ok: false };
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      console.error(`API ${path} returned an unexpected shape`, parsed.error.issues);
      return { ok: false };
    }

    return { ok: true, data: parsed.data };
  } catch (error) {
    // Log the reason, not the stack: during a build without the API running
    // this fires on every page and a full trace per page is noise.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`API ${path} unreachable: ${reason}`);
    return { ok: false };
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
