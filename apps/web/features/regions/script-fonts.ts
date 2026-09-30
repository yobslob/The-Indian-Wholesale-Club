import {
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Oriya,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
} from 'next/font/google';

/**
 * Greeting fonts per script (design.md §Visual system 3): Noto Sans for the region's own script. None is
 * preloaded, so a region page only downloads the one its greeting uses. Keys are regions.greeting_script
 * (ISO 15924); Latin greetings use the page's own font.
 */
// next/font needs literal options in every call (no shared object or spread).
const bengali = Noto_Sans_Bengali({ weight: '400', subsets: ['bengali'], display: 'swap', preload: false, adjustFontFallback: false });
const devanagari = Noto_Sans_Devanagari({ weight: '400', subsets: ['devanagari'], display: 'swap', preload: false, adjustFontFallback: false });
const gujarati = Noto_Sans_Gujarati({ weight: '400', subsets: ['gujarati'], display: 'swap', preload: false, adjustFontFallback: false });
const gurmukhi = Noto_Sans_Gurmukhi({ weight: '400', subsets: ['gurmukhi'], display: 'swap', preload: false, adjustFontFallback: false });
const kannada = Noto_Sans_Kannada({ weight: '400', subsets: ['kannada'], display: 'swap', preload: false, adjustFontFallback: false });
const malayalam = Noto_Sans_Malayalam({ weight: '400', subsets: ['malayalam'], display: 'swap', preload: false, adjustFontFallback: false });
const oriya = Noto_Sans_Oriya({ weight: '400', subsets: ['oriya'], display: 'swap', preload: false, adjustFontFallback: false });
const tamil = Noto_Sans_Tamil({ weight: '400', subsets: ['tamil'], display: 'swap', preload: false, adjustFontFallback: false });
const telugu = Noto_Sans_Telugu({ weight: '400', subsets: ['telugu'], display: 'swap', preload: false, adjustFontFallback: false });

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
