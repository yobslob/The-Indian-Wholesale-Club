# Self-hosted font files

Self-hosted so `next dev` and `next build` never fetch from Google (a network that was served different Google Fonts CSS
broke Turbopack's dev server, 2026-10-06). Latin subset only, the WOFF2 files Google Fonts serves, all under the SIL Open
Font License 1.1. Loaded by `app/fonts.ts`.
- `cinzel-latin-variable.woff2`: Cinzel (Natanael Gama), variable weight, used at 400–500: the Home name, state names,
  product titles, stamps (D-079).
- `syne-latin-variable.woff2`: Syne (Bonjour Monde), variable weight, used at 500–600: page and section headings (D-080).
- `karla-latin-variable.woff2`: Karla (Jonathan Pinhorn), variable weight, used at 400–700: everything else (D-079).
- `gelasio-latin-400.woff2`: Gelasio (Eben Sorkin), the Georgia look-alike for the logo text where Georgia is missing (D-077).
- `noto-sans-<script>-400.woff2`: Noto Sans Bengali, Devanagari, Gujarati, Gurmukhi, Kannada, Malayalam, Oriya, Tamil and
  Telugu (Google), each its own script's subset only, for region greetings (`features/regions/script-fonts.ts`).
To refresh one, download the `/* latin */` file from `https://fonts.googleapis.com/css2?family=<Family>:wght@…` with a
current Chrome user agent. Fetched 2026-10-08: Cinzel `wght@400..500`, Karla `wght@400..700`, Syne `wght@500..600`.
