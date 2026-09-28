# Design: brand, voice, visual system

> **Status:** direction only. No palette, fonts or layouts are final. Claude will propose mockups of Home, the Region
> page, the Product page and admin Listing for founder review **before** building them (coding phase). Until then, don't invent
> hex values or fonts in code. Use tokens from `packages/tokens` (created in R4 with neutral placeholder values).

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
   The map must be a static SVG (no map library) and lightweight.
5. **Photography:** real product photos taken at listing time, consistent aspect ratio (decided with the mockups). No
   stock photos presented as products.
6. **Motion:** CSS only in the storefront (no animation libraries, D-011). Respect `prefers-reduced-motion`.
7. **Light and dark:** tokens support both. Dark mode on customer pages is optional and decided at mockup time.

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
