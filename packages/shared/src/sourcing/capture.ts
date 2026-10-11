import { z } from 'zod';

/**
 * What the "Add to IWC" button (bookmarklet.ts) or the server's page fetch (html.ts) reads off a shop's product page.
 * It is untrusted input from another site: every field is optional, size-capped, and only ever parsed (normalize.ts),
 * never stored as it is.
 */
const str = (max: number) => z.string().max(max);
export const rawCaptureSchema = z.object({
  v: z.literal(1),
  url: str(2000),
  canonical: str(2000).optional(),
  title: str(1000).optional(),
  meta: z.record(z.array(str(2000)).max(20)).optional(),
  ld: z.array(str(80_000)).max(12).optional(),
  myntra: z.unknown().optional(),
  amazon: z
    .object({
      title: str(1000).optional(),
      price: str(100).optional(),
      mrp: str(100).optional(),
      byline: str(300).optional(),
      availability: str(500).optional(),
      bullets: z.array(str(2000)).max(20).optional(),
      description: str(8000).optional(),
      important: str(5000).optional(),
      specs: z
        .array(z.tuple([str(200), str(1000)]))
        .max(80)
        .optional(),
      images: z.array(str(2000)).max(80).optional(),
      size: str(100).optional(),
    })
    .optional(),
  dom: z
    .object({ images: z.array(str(2000)).max(30).optional(), h1: str(1000).optional() })
    .optional(),
});
export type RawCapture = z.infer<typeof rawCaptureSchema>;

/** A product as the importer shows it for review: one shape for every shop. Money in paise (CLAUDE.md rule 5). */
export const sourcedProductSchema = z.object({
  /** The cleaned product address (url.ts), the key that finds an earlier import. */
  url: z.string().url().max(2000),
  /** "myntra.com" */
  site: z.string().min(3).max(120),
  title: z.string().max(300),
  brand: z.string().max(120).nullable(),
  /** Plain text, paragraphs separated by blank lines. */
  description: z.string().max(8000),
  bullets: z.array(z.string().max(1000)).max(20),
  specs: z.array(z.tuple([z.string().max(200), z.string().max(1000)])).max(80),
  /** https photo addresses, the main one first. */
  images: z.array(z.string().url().max(2000)).max(15),
  pricePaise: z.number().int().positive().nullable(),
  mrpPaise: z.number().int().positive().nullable(),
  /** "INR" when the page says so or the shop is Indian; another code means the price is not in rupees. */
  currency: z.string().max(8).nullable(),
  inStock: z.boolean().nullable(),
  sizes: z.array(z.object({ label: z.string().min(1).max(40), available: z.boolean() })).max(40),
  /** The shop's own grouping ("Sarees", "Women"), used only to guess the type and category. */
  hints: z.array(z.string().max(120)).max(10),
});
export type SourcedProduct = z.infer<typeof sourcedProductSchema>;

/** Base64 of UTF-8 JSON, as the bookmarklet sends it in the import page's address (#iwc=…). */
export function decodeCapturePayload(payload: string): RawCapture | null {
  try {
    const bytes = Uint8Array.from(atob(decodeURIComponent(payload)), (c) => c.charCodeAt(0));
    const parsed = rawCaptureSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
