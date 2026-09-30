import { Gelasio_400Regular } from '@expo-google-fonts/gelasio/400Regular';
import { Gelasio_400Regular_Italic } from '@expo-google-fonts/gelasio/400Regular_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';

import TeXGyreHeros from '../assets/fonts/TeXGyreHeros-Regular.otf';

/**
 * The founder's fonts in the app (design.md §Direction, D-050 – D-052). A native font file is one weight, so
 * each weight has its own family name (tailwind.config.js maps the classes to them). Only the weights the app
 * uses are imported (each subpath is one file). Helvetica Neue and Georgia are built into iOS; Android gets
 * the look-alikes TeX Gyre Heros and Gelasio.
 */
export const FONTS = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Inter_400Regular,
  Gelasio_400Regular,
  Gelasio_400Regular_Italic,
  TeXGyreHeros,
};
