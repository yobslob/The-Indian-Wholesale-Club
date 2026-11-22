import { z } from 'zod';

/**
 * D-203: a drafted recipe as Admin → Recipes → Add drafts from a file reads it (`catalogue/recipes-drafts-*.json`,
 * plan §7). Every word stays Claude's draft (`content_status = 'draft'`) until the founder approves it in the admin.
 * Fresh things, dairy, oil, meat and anything liquid are `local` lines (D-135: liquids are not sent).
 */

export const ALL_OF_INDIA = 'All of India';

export const recipeDraftLineSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z.string().trim().max(40).default(''),
  source: z.enum(['iwc', 'local']),
  /** The words Match looks for in listing names (IWC lines only; defaults to the label). */
  match_words: z.string().trim().max(120).optional(),
});

export const recipeDraftSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['snacks', 'breakfast', 'dinner', 'sweets', 'drinks']),
  /** A region's name as the store shows it, or "All of India". */
  state: z.string().trim().min(1),
  blurb: z.string().trim().max(200),
  minutes: z.number().int().min(1).max(1440),
  soak_hours: z.number().min(0).max(48).nullable().default(null),
  serves: z.number().int().min(1).max(50),
  effort: z.enum(['easy', 'medium', 'weekend']),
  /** The CSV's rank: the shelf's order. */
  rank: z.number().int().min(1).max(10_000).optional(),
  ingredients: z.array(recipeDraftLineSchema).min(1).max(40),
  steps: z
    .array(z.object({ text: z.string().trim().min(1).max(600), minutes: z.number().int().min(0).max(1440).nullable() }))
    .min(1)
    .max(30),
});

export const recipeDraftFileSchema = z.array(recipeDraftSchema).min(1).max(100);

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

/** "Pav-Bhaji_2.JPG" → "pav-bhaji-2": a photo's file name to the slug it belongs to (plan §5.3). */
export function slugFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
