import { Cinzel_400Regular } from '@expo-google-fonts/cinzel/400Regular';
import { Cinzel_500Medium } from '@expo-google-fonts/cinzel/500Medium';
import { Gelasio_400Regular } from '@expo-google-fonts/gelasio/400Regular';
import { Karla_400Regular } from '@expo-google-fonts/karla/400Regular';
import { Karla_500Medium } from '@expo-google-fonts/karla/500Medium';
import { Karla_600SemiBold } from '@expo-google-fonts/karla/600SemiBold';
import { Syne_500Medium } from '@expo-google-fonts/syne/500Medium';
import { Syne_600SemiBold } from '@expo-google-fonts/syne/600SemiBold';

/**
 * The approved fonts in the app (D-079, D-080): Cinzel, Syne and Karla; Gelasio stands in for Georgia (the logo text)
 * on Android. A native font file is one weight, so each weight has its own family name (tailwind.config.js maps the
 * classes to them). Only the weights the app uses are imported (each subpath is one file).
 */
export const FONTS = {
  Cinzel_400Regular,
  Cinzel_500Medium,
  Syne_500Medium,
  Syne_600SemiBold,
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Gelasio_400Regular,
};
