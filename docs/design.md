# Design: brand, voice, visual system

> **Status:** direction set on 2026-09-29 (D-049); the mockup was approved on 2026-09-30 (D-055) and its tokens and fonts
> are in `packages/tokens` and `apps/web/app/fonts.ts`. Code uses the token roles, never raw hex.
> **Direction chosen (2026-09-30, D-050):** A, reworked: the hero keeps its format, everything below it is a symmetric
> full-width grid, no dark mode, fonts below. Mockup: `design/mockups/index.html` (palette with contrast, the map source,
> the founder's remaining choices). Tokens go into `packages/tokens` in C1 step 2.

## Direction (founder, D-049; layout below the hero and fonts changed by D-050)
**D-050 (2026-09-30):** Direction A. The hero keeps A's asymmetric, image-led format and motion; **everything below the
hero sits on a symmetric grid** (four equal columns of 3 : 4 rounded product photos with name, price and "Add", equal
two-panel rows), full width with small side gutters. **Fonts:** Helvetica Neue for the hero and the section headings
(D-051; TeX Gyre Heros where it is not installed, D-052), Georgia for the logo, product title and origin line (Gelasio
where it is not installed), Poppins for paragraphs, Montserrat for interface text (navigation, buttons, labels, product
names on cards), Inter for the footer only. No dark mode.
**Home hero (D-052 – D-054):** the founder's photo fills the first screen edge to edge, behind the nav bar too; "The Indian Wholesale Club" stands on its white wall,
one word per line, right-aligned, with the label "Clothing and spices from home" under it and nothing else (D-055); the
photo is AI-generated and IWC holds the rights; scrolling fades the words out while the header logo fades in. The earlier hero is archived in `design/mockups/archive/a-gallery-v3.html`.
The D-049 bullets below still apply to the hero and to motion; their asymmetric layout rules no longer apply below it.
The storefront reads like a **premium editorial magazine / contemporary gallery wall** built from large photographs:
- **Layout:** asymmetric, image-led compositions. Large photographs at varying vertical positions, varied widths,
  offsets and overlaps; images may break the grid and extend between sections; floating compositions.
- **Density (the founder's 4th prompt refines the first three):** no large empty gaps. Bigger images, sections that fill
  more of the viewport, elements closer together, clean alignment, consistent breathing room. Immersive, not sparse.
- **Motion:** Lenis smooth scrolling; subtle vertical (and some horizontal) parallax tied to scroll velocity; images
  reveal as they enter the viewport through gentle clipping, slow scale and opacity transitions.
- **Typography:** minimal, clean, luxury-magazine; photographs carry the page.
**Guard rails (built in C1: `apps/web/features/shell/motion.tsx`, tested in `e2e/motion-keyboard.spec.ts`):** motion is progressive enhancement. Lenis and the scroll effects load as one small
client module after the page is interactive; with `prefers-reduced-motion` they are off entirely (native scroll, no
parallax, images simply visible); keyboard, find-in-page, anchor links and screen readers keep working; content is fully
readable with JavaScript off. The speed budgets still hold (`engineering.md`: first-load JS ≤ 150 KB, cached pages
≤ 100 ms), and images use `next/image` with explicit sizes so the large photos don't slow the first paint. On mobile
the effects are lighter. The app follows the same look with native motion (Reanimated), not Lenis.
**Photography dependency:** the direction lives on photographs. Until real product and region photos exist (listing, C3;
region images, C2), mockups and dev pages use clearly marked placeholders, never stock photos presented as products.

## Brand [D-009]
- Name: **The Indian Wholesale Club**. Short form **IWC**. Logo: not designed yet.
- What we sell: the feeling of home (D-001). Every design choice should make a homesick person feel recognised.

## Voice
- Warm, specific and a little nostalgic, like a friend from your hometown. Never kitsch, never a stereotype.
- Specific over generic: "Kasavu mundu, the one for Onam" beats "Traditional ethnic wear".
- Honest: real origin (D-004) and real delivery windows (D-008). No fake urgency or fake scarcity.
- IWC speaks as the seller ("we"), and never about shops or India-side operations (D-003).
- Cultural facts in copy (festival names, greetings, craft history) must be accurate. Claude-written text is `draft`
  until the founder approves it (D-019).
- **The founder's rule for drafted copy (D-059):** "Not a single word should give away the AI tone or AI slop, be human,
  be relateable, be creative, be out of the box, be frank, be natural." In practice: short sentences, plain words, a
  joke where a person would make one; no "vibrant", "rich heritage", "timeless", "curated with love", no stacked
  adjectives, no "whether you're…", no em-dash asides. Read it aloud; if it sounds like an ad, rewrite it.

## Visual system (principles)
1. **Neutral, warm base with one brand colour.** Content and photos carry the colour.
2. **Per-region accent:** each region has `accent_color`, applied through one CSS variable (`--region-accent`) on its pages.
   It must meet WCAG AA contrast against the base. **Not checked yet:** the admin form only checks the hex format; a
   contrast check comes with the design (coding phase).
3. **Scripts:** greetings render in the region's own script (Devanagari, Bengali, Gujarati, Gurmukhi, Odia, Tamil,
   Telugu, Kannada, Malayalam, Meetei Mayek, Ol Chiki, Latin for several north-eastern languages…). Use Noto Sans for
   the specific script, **subset and loaded only on that region's page** (speed, D-011).
4. **India map:** use a map consistent with **India's official boundaries**. This audience will notice immediately.
   The map must be a static SVG (no map library) and lightweight. Source: DataMeet's state boundaries (CC BY 4.0, credit shown
   under the map and in the footer), about 27 KB gzipped (approved, D-052).
5. **Photography:** real product photos taken at listing time, consistent aspect ratio (decided with the mockups). No
   stock photos presented as products.
6. **Motion:** as §Direction (D-049): Lenis smooth scroll + reveal/parallax, the only motion library allowed on the
   storefront (no framer-motion), off for `prefers-reduced-motion`. Everything else CSS.
7. **Light only:** no dark mode on customer pages (D-050).

## Tokens (`packages/tokens`)
One source for web (Tailwind preset) and app (NativeWind): `packages/tokens/tokens.js` → `preset.js`. Components use
roles, never raw hex. **Final values since C1 (2026-09-30)**, taken from the approved mockup (D-050 – D-055); the
unit test `packages/tokens/tests` fails if a text colour drops below WCAG AA on a page background.
| Role | Tailwind name | Use |
|---|---|---|
| page background | `canvas` | `bg-canvas` |
| panels, cards | `surface` | `bg-surface` |
| pills, inputs, lightest layer | `paper` | `bg-paper` |
| main / secondary text | `ink`, `ink-muted` | `text-ink`, `text-ink-muted` |
| borders | `line` | `border-line` |
| IWC brand + text on it | `brand`, `on-brand` | primary buttons |
| region accent (fallback) | `region` | overridden per region by `regions.accent_color` |
| map regions not open yet | `land` | the India map |
| status | `positive`, `caution`, `danger` | alerts, badges |
Also `rounded-sm/md/lg/pill`, `duration-fast/base/slow` and the font roles `font-hero`, `font-display`, `font-body`,
`font-ui`, `font-foot` (§Direction; the web maps them to its self-hosted fonts in `apps/web/app/fonts.ts`, the app to
the fonts it loads in `apps/app/lib/fonts.ts`, with one class per weight). The names
avoid the old theme's keys (`primary`, `accent`, `success`, …); a test keeps them from coming back.

## Accessibility (non-negotiable)
WCAG 2.2 AA: contrast, focus states, keyboard navigation, alt text on every product image (entered at listing),
touch targets ≥ 44 px (both admin and customer, since admins work on phones).
**Accepted exception (founder, D-052):** the region album moves by itself with no pause control (WCAG 2.2.2); it stops
for "reduce motion" and when off screen.

## Admin look
Plain, dense and fast. The same tokens, no brand decoration. Phone layouts for field jobs (`admin.md`).
Since C1 the web admin follows the approved mockup's admin screen (D-050; `apps/web/features/admin/ui.tsx`): Helvetica
Neue page titles, Montserrat labels and controls, paper fields, ink primary buttons, small uppercase section labels,
view tabs (Listings: New / Drafts / Live / Paused / All), one scrolling nav row on phones. The Listings form picks the
type with a Clothing / Spice toggle that shows only that type's fields (CSS, no client code).
