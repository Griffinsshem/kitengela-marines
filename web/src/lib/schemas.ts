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

// --- team detail -----------------------------------------------------------

export const teamDetailSchema = teamSchema.extend({
  next_fixture: fixtureSchema.nullable(),
  latest_result: fixtureSchema.nullable(),
});

export const playerSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  known_as: z.string().nullable(),
  display_name: z.string(),
  slug: z.string(),
  squad_number: z.number().nullable(),
  position: z.string(),
  status: z.string(),
  nationality: z.string().nullable(),
  biography: z.string().nullable(),
  photo_url: z.string().nullable(),
  joined_on: z.string().nullable(),
  team: teamRefSchema,
});

export const playerStatisticsSchema = z.object({
  appearances: z.number(),
  starts: z.number(),
  minutes_played: z.number(),
  goals: z.number(),
  assists: z.number(),
  yellow_cards: z.number(),
  red_cards: z.number(),
  clean_sheets: z.number().optional(),
  goals_conceded: z.number().optional(),
  saves: z.number().optional(),
});

export const playerDetailSchema = playerSchema.extend({
  statistics: playerStatisticsSchema,
  statistics_season: z.string().nullable(),
});

export const squadSchema = z.object({
  goalkeepers: z.array(playerSchema),
  defenders: z.array(playerSchema),
  midfielders: z.array(playerSchema),
  forwards: z.array(playerSchema),
});

export const staffMemberSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),
  slug: z.string(),
  role: z.string(),
  biography: z.string().nullable(),
  photo_url: z.string().nullable(),
  display_order: z.number(),
  team: teamRefSchema.nullable(),
});

export const teamDetailResponseSchema = z.object({ data: teamDetailSchema });
export const squadResponseSchema = z.object({
  data: squadSchema,
  meta: z.object({ total: z.number() }),
});
export const playerDetailResponseSchema = z.object({ data: playerDetailSchema });
export const staffResponseSchema = z.object({ data: z.array(staffMemberSchema) });

export type TeamDetail = z.infer<typeof teamDetailSchema>;
export type Player = z.infer<typeof playerSchema>;
export type PlayerDetail = z.infer<typeof playerDetailSchema>;
export type PlayerStatistics = z.infer<typeof playerStatisticsSchema>;
export type Squad = z.infer<typeof squadSchema>;
export type StaffMember = z.infer<typeof staffMemberSchema>;

// --- match detail ----------------------------------------------------------

export const playerRefSchema = z.object({
  display_name: z.string(),
  slug: z.string(),
  squad_number: z.number().nullable(),
  position: z.string(),
});

export const matchEventSchema = z.object({
  type: z.string(),
  minute: z.number().nullable(),
  added_time: z.number().nullable(),
  is_opposition: z.boolean(),
  player: playerRefSchema.nullable(),
  related_player: playerRefSchema.nullable(),
  note: z.string().nullable(),
});

export const lineupEntrySchema = z.object({
  player: playerRefSchema,
  role: z.string(),
  minutes_played: z.number(),
  goals: z.number(),
  assists: z.number(),
  yellow_cards: z.number(),
  red_cards: z.number(),
  clean_sheet: z.boolean().nullable().optional(),
  goals_conceded: z.number().nullable().optional(),
  saves: z.number().nullable().optional(),
});

export const matchDetailSchema = fixtureSchema.extend({
  report: z.string().nullable(),
  player_of_the_match: playerRefSchema.nullable(),
  events: z.array(matchEventSchema),
  lineup: z.object({
    starters: z.array(lineupEntrySchema),
    substitutes: z.array(lineupEntrySchema),
    unused_substitutes: z.array(lineupEntrySchema),
  }),
});

export const matchDetailResponseSchema = z.object({ data: matchDetailSchema });

export type PlayerRef = z.infer<typeof playerRefSchema>;
export type MatchEvent = z.infer<typeof matchEventSchema>;
export type LineupEntry = z.infer<typeof lineupEntrySchema>;
export type MatchDetail = z.infer<typeof matchDetailSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// --- article detail --------------------------------------------------------

export const articleDetailSchema = articleSummarySchema.extend({
  // Sanitised by the API on save and again on read.
  body_html: z.string(),
  fixture: z.object({ slug: z.string() }).nullable(),
});

export const articleCategorySchema = z.object({ name: z.string(), slug: z.string() });

export const articleDetailResponseSchema = z.object({ data: articleDetailSchema });
export const articleCategoriesResponseSchema = z.object({
  data: z.array(articleCategorySchema),
});

export type ArticleDetail = z.infer<typeof articleDetailSchema>;
export type ArticleCategory = z.infer<typeof articleCategorySchema>;
