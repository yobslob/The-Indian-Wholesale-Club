/**
 * Image optimization utilities & shimmer placeholders
 * Section 8: Image Optimization Strategy
 */

const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f5f5f5" offset="20%" />
      <stop stop-color="#eeeeee" offset="50%" />
      <stop stop-color="#f5f5f5" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f5f5f5" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1.2s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined' ? Buffer.from(str).toString('base64') : window.btoa(str);

/**
 * Returns a base64 encoded SVG shimmer placeholder data URL
 */
export function getShimmerDataUrl(w = 300, h = 400): string {
  return `data:image/svg+xml;base64,${toBase64(shimmer(w, h))}`;
}

/**
 * Standard image responsive sizes presets matching Section 8.2
 */
export const IMAGE_SIZES_PRESETS = {
  thumbnail: '64px',
  small: '(max-width: 640px) 50vw, 200px',
  grid: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  pdp: '(max-width: 768px) 100vw, 50vw',
  full: '100vw',
} as const;
