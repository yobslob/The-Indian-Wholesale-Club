# Design mockups (coding plan C1)

Throwaway HTML mockups of the three design directions for the founder to choose from (D-049, `docs/design.md`).
They are not part of any app or build, and nothing here is a decision until the founder picks.

Start at `index.html`: it links the three directions (A gallery wall, B magazine spread, C immersive/dark), shows each
palette with its contrast check, and lists what the founder decides. Each direction has Home, Region (Kerala), Product and
the admin Listing screen; `shared/` holds the motion layer, placeholder photos, mockup data and the admin screen.

Open the files directly, or serve the folder: `python -m http.server 4321 --directory design/mockups` (also the
`mockups` entry in `.claude/launch.json`). Fonts and Lenis load from a CDN, so an internet connection is needed.

All photos, sample names, prices, dates and counts are placeholders; region greetings are the seeded drafts (D-019).
