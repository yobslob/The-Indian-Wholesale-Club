/**
 * The photo check a vendor's phone runs right after each shot (D-103): too small, too dark, too bright or blurry, so a
 * retake costs seconds instead of a day. Pure: the caller hands over grey pixels (0 – 255).
 * Calibrated in the spike (2026-10-10): blur must be measured at full resolution on a centre crop (a shrunken copy
 * hides it): sharp photos scored 94 and up (a plain black kurta was the lowest), blurred copies 2. Glare is not
 * checked here: a white or cream garment looks the same as glare without knowing where the garment is.
 */

export type PhotoIssue = 'small' | 'dark' | 'bright' | 'blurry';

export const MIN_SIDE = 1000;          // px, the shorter side of the photo as taken
const DARK_MEAN = 55;
const BRIGHT_MEAN = 238;
const BLUR_LIMIT = 25;                 // variance of the Laplacian on the centre crop

/** Mean brightness of a grey image. */
export function meanBrightness(grey: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < grey.length; i++) sum += grey[i] ?? 0;
  return grey.length ? sum / grey.length : 0;
}

/** Variance of the Laplacian of a square grey crop (side × side): low means blurry. */
export function sharpness(crop: ArrayLike<number>, side: number): number {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < side - 1; y++) {
    for (let x = 1; x < side - 1; x++) {
      const i = y * side + x;
      const v =
        4 * (crop[i] ?? 0) - (crop[i - 1] ?? 0) - (crop[i + 1] ?? 0) - (crop[i - side] ?? 0) - (crop[i + side] ?? 0);
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export type PhotoChecks = { width: number; height: number; brightness: number; sharpness: number; issues: PhotoIssue[] };

/**
 * `overview`: the whole photo shrunk (any size) for brightness; `crop`: a full-resolution centre crop (side × side)
 * for blur; `width` / `height`: the photo as taken.
 */
export function checkPhoto(input: {
  width: number;
  height: number;
  overview: ArrayLike<number>;
  crop: ArrayLike<number>;
  cropSide: number;
}): PhotoChecks {
  const brightness = meanBrightness(input.overview);
  const sharp = sharpness(input.crop, input.cropSide);
  const issues: PhotoIssue[] = [];
  if (Math.min(input.width, input.height) < MIN_SIDE) issues.push('small');
  if (brightness < DARK_MEAN) issues.push('dark');
  else if (brightness > BRIGHT_MEAN) issues.push('bright');
  if (sharp < BLUR_LIMIT) issues.push('blurry');
  return {
    width: input.width,
    height: input.height,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharp),
    issues,
  };
}
