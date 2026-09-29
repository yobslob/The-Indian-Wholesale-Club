# Design: brand, voice, visual system

> **Status:** the founder set the direction on 2026-09-29 (D-049, §Direction below). No palette, fonts or layouts are
> final yet: Claude proposes mockups of Home, the Region page, the Product page and admin Listing that follow the
> direction, for founder review **before** building them (coding plan C1). Until then, don't invent hex values or fonts in
> code. Use tokens from `packages/tokens` (created in R4 with neutral placeholder values).
> **Direction chosen (2026-09-30, D-050):** A, reworked: the hero keeps its format, everything below it is a symmetric
> full-width grid, no dark mode, fonts below. Mockup: `design/mockups/index.html` (palette with contrast, the map source,
> the founder's remaining choices). Tokens go into `packages/tokens` in C1 step 2.

## Direction (founder, D-049; layout below the hero and fonts changed by D-050)
**D-050 (2026-09-30):** Direction A. The hero keeps A's asymmetric, image-led format and motion; **everything below the
hero sits on a symmetric grid** (four equal columns of 3 : 4 rounded product photos with name, price and "Add", equal
two-panel rows), full width with small side gutters. **Fonts:** Helvetica Neue for the hero and the section headings
(D-051; web licence Q-24), Georgia for the logo, product title and origin line, Poppins for paragraphs, Montserrat for
interface text (navigation, buttons, labels, product names on cards), Inter for the footer only. No dark mode.
The D-049 bullets below still apply to the hero and to motion; their asymmetric layout rules no longer apply below it.
The storefront reads like a **premium editorial magazine / contemporary gallery wall** built from large photographs:
- **Layout:** asymmetric, image-led compositions. Large photographs at varying vertical positions, varied widths,
  offsets and overlaps; images may break the grid and extend between sections; floating compositions.
- **Density (the founder's 4th prompt refines the first three):** no large empty gaps. Bigger images, sections that fill
  more of the viewport, elements closer together, clean alignment, consistent breathing room. Immersive, not sparse.
- **Motion:** Lenis smooth scrolling; subtle vertical (and some horizontal) parallax tied to scroll velocity; images
  reveal as they enter the viewport through gentle clipping, slow scale and opacity transitions.
- **Typography:** minimal, clean, luxury-magazine; photographs carry the page.
**Guard rails (proposed with D-049):** motion is progressive enhancement. Lenis and the scroll effects load as one small
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

## Visual system (principles)
1. **Neutral, warm base with one brand colour.** Content and photos carry the colour.
2. **Per-region accent:** each region has `accent_color`, applied through one CSS variable (`--region-accent`) on its pages.
   It must meet WCAG AA contrast against the base. **Not checked yet:** the admin form only checks the hex format; a
   contrast check comes with the design (coding phase).
3. **Scripts:** greetings render in the region's own script (Devanagari, Bengali, Gujarati, Gurmukhi, Odia, Tamil,
   Telugu, Kannada, Malayalam, Meetei Mayek, Ol Chiki, Latin for several north-eastern languages…). Use Noto Sans for
   the specific script, **subset and loaded only on that region's page** (speed, D-011).
4. **India map:** use a map consistent with **India's official boundaries**. This audience will notice immediately.
   The map must be a static SVG (no map library) and lightweight. The mockup draws it from DataMeet's state boundaries
   (CC BY 4.0, credit shown), about 27 KB gzipped; the source is confirmed with Q-21.
5. **Photography:** real product photos taken at listing time, consistent aspect ratio (decided with the mockups). No
   stock photos presented as products.
6. **Motion:** as §Direction (D-049): Lenis smooth scroll + reveal/parallax, the only motion library allowed on the
   storefront (no framer-motion), off for `prefers-reduced-motion`. Everything else CSS.
7. **Light only:** no dark mode on customer pages (D-050).

## Tokens (`packages/tokens`, created in R4)
One source for web (Tailwind preset) and app (NativeWind): `packages/tokens/tokens.js` → `preset.js`. Components use
roles, never raw hex. Values are **placeholders** (the pre-restructure UI's own colours) until the mockups are approved.
| Role | Tailwind name | Use |
|---|---|---|
| page background | `canvas` | `bg-canvas` |
| cards, panels | `surface` | `bg-surface` |
| main / secondary text | `ink`, `ink-muted` | `text-ink`, `text-ink-muted` |
| borders | `line` | `border-line` |
| IWC brand | `brand` | buttons, logo |
| region accent (fallback) | `region` | overridden per region by `regions.accent_color` |
| status | `positive`, `caution`, `danger` | alerts, badges |
Also `rounded-sm/md/lg` and `duration-fast/base/slow`. The names avoid the old theme's keys (`primary`, `accent`,
`success`, …); that theme was deleted in R5/R6 and a test (`packages/tokens/tests`) keeps the names from coming back. Type scale, spacing and shadows are added with the mockups.

## Accessibility (non-negotiable)
WCAG 2.2 AA: contrast, focus states, keyboard navigation, alt text on every product image (entered at listing),
touch targets ≥ 44 px (both admin and customer, since admins work on phones).

## Admin look
Plain, dense and fast. The same tokens, no brand decoration. Phone layouts for field jobs (`admin.md`).
