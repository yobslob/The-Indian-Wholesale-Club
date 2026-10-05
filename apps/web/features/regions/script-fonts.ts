import localFont from 'next/font/local';

/**
 * Greeting fonts per script (design.md §Visual system 3): Noto Sans for the region's own script, the script's subset
 * only, self-hosted from app/fonts (SIL Open Font License; see app/fonts/README.md). None is preloaded, so a region page
 * only downloads the one its greeting uses. Keys are regions.greeting_script (ISO 15924); Latin greetings use the
 * page's own font.
 */
// next/font needs literal options in every call (no shared object or spread).
const bengali = localFont({ src: '../../app/fonts/noto-sans-bengali-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const devanagari = localFont({ src: '../../app/fonts/noto-sans-devanagari-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const gujarati = localFont({ src: '../../app/fonts/noto-sans-gujarati-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const gurmukhi = localFont({ src: '../../app/fonts/noto-sans-gurmukhi-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const kannada = localFont({ src: '../../app/fonts/noto-sans-kannada-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const malayalam = localFont({ src: '../../app/fonts/noto-sans-malayalam-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const oriya = localFont({ src: '../../app/fonts/noto-sans-oriya-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const tamil = localFont({ src: '../../app/fonts/noto-sans-tamil-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });
const telugu = localFont({ src: '../../app/fonts/noto-sans-telugu-400.woff2', weight: '400', display: 'swap', preload: false, adjustFontFallback: false });

const BY_SCRIPT: Record<string, string> = {
  Beng: bengali.className,
  Deva: devanagari.className,
  Gujr: gujarati.className,
  Guru: gurmukhi.className,
  Knda: kannada.className,
  Mlym: malayalam.className,
  Orya: oriya.className,
  Taml: tamil.className,
  Telu: telugu.className,
};

/** The class that sets a greeting in its script's font, or '' (Latin, unknown). */
export function scriptFontClass(script: string | null): string {
  return (script && BY_SCRIPT[script]) || '';
}
