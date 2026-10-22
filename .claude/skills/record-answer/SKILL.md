---
name: record-answer
description: File a founder's answer or decision the IWC way - verbatim quote as a new D-entry in docs/decisions.md, the question closed in docs/questions.md, every doc and code comment that cited it updated. Use whenever the founder answers a Q-xx, changes a rule, or gives a new product/design direction.
argument-hint: "[Q-id or topic]"
---

# Record a founder answer (CLAUDE.md §Anti-hallucination rules, D-012)

1. **Quote, don't paraphrase.** Append a new entry at the end of `docs/decisions.md` under "Recent (full text)"
   (next free D-number, today's date; older entries' full text is in `docs/archive/decisions-full.md`):
   `**D-0xx · YYYY-MM-DD · founder (was Q-xx): <short title>**`, then `Founder, verbatim: "<exact words, typos kept>"`.
2. **Say what it means for the build**, and mark anything you had to interpret as `*Interpretation (proposed, confirm
   when <phase> starts):*`. Never turn an interpretation into a rule silently. If a part is still unclear, narrow the
   question in `docs/questions.md` instead of guessing.
3. If it replaces an earlier rule, write `Supersedes D-xxx` and mark the old entry's index line `SUPERSEDED by D-yyy`
   (the only edit allowed to an old entry). When "Recent" holds more than about ten entries, move the oldest full text to
   the end of `docs/archive/decisions-full.md` and leave a one-line index entry each.
4. **Close the question:** delete its row from `docs/questions.md` and add the id to the "answered" line at the top.
5. **Update everything that cited it:** `grep -rn "Q-xx" docs apps packages supabase scripts` - docs that said "until
   Q-xx is answered", `TODO(founder): Q-xx` markers, code comments. Point them at the new D-entry. Update
   `docs/status.md` (Next for the founder, Not built yet) when a step waited on it.
6. Run `node scripts/docs-audit.mjs` (every cited D-/Q- id must exist), then commit with a message that names the
   decision.
