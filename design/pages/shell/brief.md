# shell: header, nav, demo banner, footer · app tab bar and screen header

**Surface:** website (every page) + app (every customer screen) · **Code:** `apps/web/features/shell/`
(`site-header.tsx`, `logo.tsx`, `demo-banner.tsx`, `site-footer.tsx`; Home's header look in `apps/web/app/globals.css`),
`apps/app/app/(customer)/_layout.tsx` · **Status:** approved D-079 (2026-10-08), not built yet

## The page's job
The frame around every page: say where you are (logo), get you anywhere in one tap (states, clothing, spices, search,
account, bag), and stay out of the photographs' way. On Home it sits on the hero photo until you scroll past it.

## What it shows
Logo text with the India-I (D-077) · nav: States, Clothing, Spices, Search, Account, Bag with its count · the demo
banner while the demo round runs (D-078) · footer: name and line, Shop / Help / About links, map credit (D-052).
No admin link anywhere (D-006). App: tabs Home · Explore · Bag · Saved · Profile (`storefront.md` §Mobile app).

## Today (production, 2026-10-07; crops in `today/`)
1. **Phones (390):** the nav does not fit on one row. It wraps under the logo, so the header is 123 px tall
   (`header-page-390.png`). There is no menu.
2. **Home, every width:** the fixed header sits on top of the demo banner, so the links overlap the banner's text
   (`header-home-*.png`). At 390 it is unreadable.
3. **Demo banner:** four lines on a phone (about 90 px). With the two-row header, 190 px of chrome sits above
   every page before any content.
4. **Bag:** says "Bag" with no count when empty and no visible badge style when not, so the most useful number in the
   header is easy to miss.
5. **No "you are here":** the current section is not marked in the nav.
6. **Home hero at 390:** the brand name's last word ("Club") is cut by the bottom of the first screen (844 px tall).
   This belongs to `home`, noted here because the header's height causes part of it.
7. **Footer:** works at both widths. At 390 the name breaks over two lines next to Shop, and the columns are uneven.
8. **App:** the stock tab bar: system font labels, Ionicons outlines, no brand touch; each screen draws its own header.

## Founder's direction
"Let's refine what's approved" (2026-10-07). Customer side first, every device, then admin.

## Design (round 1 proposal)
Kept: the logo, the nav words and order, the cream solid header, transparent on the Home photo with the logo fading in,
Montserrat 13 px links, the dark footer in Inter with four columns on desktop.

Refined:
- **One row at every width.** 1440 and 1024: as today, plus the current section underlined and Bag with a count pill.
  768: the same row, gaps tighter. 390: the logo at 18 px, then the Bag icon with its count, then **Menu**. Header 56 px.
- **Phone menu:** a full-screen cream sheet: the six places in the hero font at 30 px, then Track an order, How it
  works, Contact in small text. Built as `<details>` + CSS, so no new client JavaScript (D-011, PR-1).
- **Demo banner:** one line, above the header on every page including Home (the header starts below it, never on top
  of it). Phones get the short line, and "Test card" opens the card details. The banner copy is a draft.
- **Bag count:** a small pill in the brand colour once something is in the bag; nothing when empty.
- **Footer at 390:** the name and line on their own row, then Shop and Help side by side, About under Shop.
- **App tab bar:** cream background with a hairline on top, Montserrat 11 px labels, the active tab in ink with a short
  brand-colour bar above its icon, the inactive tabs in ink-muted, the Bag badge in the brand colour. Line icons at
  1.5 px stroke to match the logo's outline.
- **App screen header:** tab roots get a large title in the hero font (32 px, left), pushed screens a 56 px bar with a
  44 px back button and a 17 px title.

States shown: on the photo, solid, phone menu open, bag empty and with 3 pieces, demo banner on and off.

## Needs
- Banner copy shortened (draft, D-059); the founder approves or rewrites it.
- Footer name: D-077 kept "The Indian Wholesale Club" in the footer "until the founder says otherwise". The mockup keeps
  it. Question for the founder: should the footer use the new logo text too?

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-07 | 1 | — | first proposal |
| 2026-10-07 | 2 | "Remove clothing and spices form header and footers, add about us, instead of account I need three icons heart(whislisht/liked), bag(cart with the number), profile(guest or signed in doesnt matter) these three icons should be there. When search is clicked another page opens, instead as soon as search is hovered it transitions into the search placeholder pill and when the mouse is taken off it transitions back into the text of search. The Indian Wholesale club text should be more lower in the hero seciton, remove the clothing and spices from home and replace with(Miss local market? Start here.) the fonts are very trash change them. when the hamburger icon is clicked, the whole screen is taken by the sidepanel, instead it should be smoothly opened as a sidepanel hovering over the homepage and close like it opened, also it shouldn't be mentioned menu and close, the icons are enough, in webapp of phone, the footer should be very small and minimal,remove extra things" | nav: States · Search · About us + heart / bag (count) / profile icons; Clothing and Spices out of header and footer; Search morphs into a pill on hover and back on mouse-out (stays open once typed in; Enter opens the results page); hero name moved to the lower right with "Miss local market? Start here."; four font pairings to choose from (logo stays Georgia, its India mark is fitted to Georgia); phone menu is a side panel from the right over the page, same easing in and out, icons only; phone footer reduced to one block of small links |
| 2026-10-07 | 3 | "All fonts are trash, the text is too much big and lower than before I need it in center with right aligned with the screen and always on the whitish part of the wall whatever the size of the screen is(adjust the size of text accordingly). the color should be #1D1A17(for hero headline and black for rest) don't add any blur anywhere" | the name is placed with the photo's own crop maths on the white wall (image x 690 - 1117, y 335 - 670): centred on the wall, right-aligned to the screen, sized to the wall (checked at 13 screen sizes, 2560 x 1080 to 360 x 740, all on the wall); photo crop 85 % across so phones keep the wall; headline #1D1A17, the rest black; no shade, no text or panel shadows; a gallery of 20 headline and 13 text fonts, chosen separately; the Home header is solid by default (black nav on the photo is unreadable over the disc without a shade), "on the photo" kept as a toggle |
| 2026-10-08 | 4 | "I choose cinzel and karla, also why did you make the header bg solid make it on the photo and you also removed the fade in algorithm of the logo text in the header, undo it. footer text is fine. let's finalize and go to next steps" | Cinzel + Karla; header back on the photo with the scroll fade (words out, logo in, header cream once the photo has passed), shown in scrollable frames; footer line kept; font gallery and toggles removed; approved as D-079 |

### Round 2 open points (closed by D-079)
- **Fonts:** pick one of the four pairings (or none). The chosen pair replaces D-050 – D-052's five fonts with two.
- **Footer line** "Clothing and spices from all of India, delivered in the US." still names clothing and spices
  (desktop footer). Keep, drop, or new words?
- **"Start here"** links to Pick your home on the same page (proposal).
- **App:** the tab bar already has Home · Explore · Bag · Saved · Profile, so round 2 leaves it as round 1 (fonts follow
  the chosen pair).
