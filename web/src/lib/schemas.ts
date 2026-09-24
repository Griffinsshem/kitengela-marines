/**
 * Runtime shapes of API responses.
 *
 * TypeScript types vanish at runtime, so a renamed or missing field from the
 * Flask API would otherwise surface as `undefined` deep inside a component.
 * Parsing at the boundary turns that into one logged, contained failure.
 */

import { z } from "zod";

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  slug: z.string(),
  category: z.string(),
  gender: z.string(),
  accent_key: z.string(),
  summary: z.string().nullable(),
});

export const clubSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  slug: z.string(),
  founded_year: z.number().int().nullable(),
  home_ground: z.string().nullable(),
  town: z.string().nullable(),
  county: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  summary: z.string().nullable(),
  mission: z.string().nullable(),
});

export const teamsResponseSchema = z.object({ data: z.array(teamSchema) });
export const clubResponseSchema = z.object({ data: clubSchema.nullable() });

export type Team = z.infer<typeof teamSchema>;
export type Club = z.infer<typeof clubSchema>;

// --- shared references -----------------------------------------------------

export const paginationMetaSchema = z.object({
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
  pages: z.number(),
});

export const teamRefSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  slug: z.string(),
  accent_key: z.string(),
});

export const mediaAssetSchema = z.object({
  url: z.string(),
  alt: z.string(),
  caption: z.string().nullable(),
  width: z.number(),
  height: z.number(),
});

// --- matches ---------------------------------------------------------------

export const fixtureSchema = z.object({
  slug: z.string(),
  status: z.string(),
  venue: z.string(),
  venue_name: z.string().nullable(),
  kickoff_at: z.string().nullable(),
  scheduled_on: z.string().nullable(),
  team: teamRefSchema,
  opponent: z.object({
    name: z.string(),
    short_name: z.string(),
    slug: z.string(),
    crest_url: z.string().nullable(),
  }),
  competition: z.object({ name: z.string(), short_name: z.string(), slug: z.string() }),
  season: z.string(),
  our_score: z.number().nullable(),
  their_score: z.number().nullable(),
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
  result: z.string().nullable(),
  is_completed: z.boolean(),
});

export const standingSchema = z.object({
  position: z.number(),
  club: z.object({ name: z.string(), short_name: z.string(), slug: z.string() }),
  is_our_club: z.boolean(),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  goal_difference: z.number(),
  points: z.number(),
});

export const seasonRefSchema = z.object({
  label: z.string(),
  slug: z.string(),
  is_current: z.boolean(),
  competition: z.object({
    name: z.string(),
    short_name: z.string(),
    slug: z.string(),
    has_standings: z.boolean(),
  }),
});

// --- editorial -------------------------------------------------------------

export const articleSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  published_at: z.string().nullable(),
  category: z.object({ name: z.string(), slug: z.string() }),
  team: teamRefSchema.nullable(),
  author: z.string(),
  featured_image: mediaAssetSchema.nullable(),
});

export const gallerySummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  event_date: z.string().nullable(),
  photo_count: z.number(),
  cover: mediaAssetSchema.nullable(),
  team: teamRefSchema.nullable(),
});

export const sponsorSchema = z.object({
  name: z.string(),
  slug: z.string(),
  website_url: z.string().nullable(),
  description: z.string().nullable(),
  tier: z.string(),
  logo: mediaAssetSchema.nullable(),
});

// --- response envelopes ----------------------------------------------------

export const fixturesResponseSchema = z.object({
  data: z.array(fixtureSchema),
  meta: paginationMetaSchema,
});
export const articlesResponseSchema = z.object({
  data: z.array(articleSummarySchema),
  meta: paginationMetaSchema,
});
export const galleriesResponseSchema = z.object({
  data: z.array(gallerySummarySchema),
  meta: paginationMetaSchema,
});
export const standingsResponseSchema = z.object({
  data: z.array(standingSchema),
  meta: z.object({ season: seasonRefSchema.nullable() }),
});
export const sponsorsResponseSchema = z.object({ data: z.array(sponsorSchema) });

export type TeamRef = z.infer<typeof teamRefSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type Fixture = z.infer<typeof fixtureSchema>;
export type Standing = z.infer<typeof standingSchema>;
export type SeasonRef = z.infer<typeof seasonRefSchema>;
export type ArticleSummary = z.infer<typeof articleSummarySchema>;
export type GallerySummary = z.infer<typeof gallerySummarySchema>;
export type Sponsor = z.infer<typeof sponsorSchema>;
