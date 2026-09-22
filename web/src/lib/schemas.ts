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
