# Self-hosted font files

`tex-gyre-heros-latin.woff`: TeX Gyre Heros Regular (a free Helvetica look-alike, used only where Helvetica Neue is
not installed, D-052), subset to Latin with fontTools. Source: `texgyreheros-regular.otf` from CTAN
(`fonts/tex-gyre/opentype`), GUST Font License (LPPL 1.3c). The full original is kept in
`design/mockups/assets/`. Loaded by `app/fonts.ts`.

The Google fonts, self-hosted since 2026-10-06 so `next dev` and `next build` never fetch from Google (a network that
was served different Google Fonts CSS broke Turbopack's dev server). Latin subset only, the WOFF2 files Google Fonts
serves for the weights the site uses, all under the SIL Open Font License 1.1:
- `poppins-latin-{400,500,600}.woff2`: Poppins (Indian Type Foundry), body text.
- `montserrat-latin-variable.woff2`: Montserrat (Julieta Ulanovsky et al.), variable weight, used at 500–700 for controls.
- `inter-latin-variable.woff2`: Inter (Rasmus Andersson), variable weight, used at 400–500 in the footer.
- `gelasio-latin-400.woff2`, `gelasio-latin-italic-400.woff2`: Gelasio (Eben Sorkin), the Georgia look-alike.
- `noto-sans-<script>-400.woff2`: Noto Sans Bengali, Devanagari, Gujarati, Gurmukhi, Kannada, Malayalam, Oriya, Tamil and
  Telugu (Google), each its own script's subset only, for region greetings (`features/regions/script-fonts.ts`).
To refresh one, download the `/* latin */` file from `https://fonts.googleapis.com/css2?family=<Family>:wght@…` with a
current Chrome user agent.
