import { z } from 'zod';

/**
 * A vendor's piece (D-102, D-103), as the vendor fills it in (website and app). The database checks the same rules
 * again in vendor_submit; this gives the vendor the answer before anything is sent.
 */

export const WEARS = ['women', 'men', 'kids', 'unisex'] as const;
export type Wears = (typeof WEARS)[number];

export const PHOTO_VIEWS = ['front', 'back', 'closeup'] as const;
export type PhotoView = (typeof PHOTO_VIEWS)[number];

/** Clothing needs all three; spices a front photo and a close-up (vendor_submit). */
export const viewsNeeded = (productType: 'clothing' | 'spice'): PhotoView[] =>
  productType === 'clothing' ? ['front', 'back', 'closeup'] : ['front', 'closeup'];

/** The sizes a vendor taps most; any other label can be typed. */
export const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free size'] as const;

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined));

export const pieceFormSchema = z.object({
  category_id: z.string().uuid(),
  wears: z.enum(WEARS),
  fabric: optionalText,
  care: optionalText,
  colour: optionalText,
  note: optionalText,
  /** Whole rupees, as the shop says its price. */
  price_rupees: z.coerce.number().int().min(1).max(10_000_000),
  sizes: z
    .array(z.object({ label: z.string().trim().min(1).max(60), qty: z.coerce.number().int().min(1).max(999) }))
    .min(1)
    .max(30),
});
export type PieceForm = z.infer<typeof pieceFormSchema>;

/** What vendor_submit takes: money as integer paise (CLAUDE.md, money is always an integer). */
export function toSubmitDetails(form: PieceForm) {
  return {
    category_id: form.category_id,
    wears: form.wears,
    fabric: form.fabric,
    care: form.care,
    colour: form.colour,
    note: form.note,
    shop_price_paise: form.price_rupees * 100,
    variants: form.sizes.map((s) => ({ label: s.label, qty: s.qty })),
  };
}

/** Where a photo goes in the vendor-uploads bucket: <vendor>/<submission>/<view>-<stamp>.jpg (a retake gets a new name). */
export const uploadPath = (vendorId: string, submissionId: string, view: PhotoView, stamp: number): string =>
  `${vendorId}/${submissionId}/${view}-${stamp}.jpg`;

/** Rupees for people: 120000 paise → "₹1,200". */
export const formatRupees = (paise: number): string =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(paise / 100))}`;
