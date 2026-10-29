# 21 · Classes, avatars, achievements, glossary and the offline report (design drafts, nothing built)

Small account-level features that came out of the landing page and rankings work ([15](15-leaderboard-and-world-preview.md), [16](16-landing-and-play-route.md)). Achievements and the glossary are **drafts for later**; the rest is designed enough to build.

## 1. Classes become a source of small bonuses (avatar is separate)
- **Today:** four classes (`PLAYER_CLASSES`: warrior, paladin, ranger, mage) are cosmetic; the choice lives in `profiles.player_class`, which only the server writes.
- **Decided (2026-10-29): small passive bonuses, mixed economy and combat.** Each class gets one economy passive and one combat passive, each small (proposal at most +5 %) so no class is a wrong pick. Proposals, to tune: warrior (+armor, +kill gold), paladin (+HP regeneration, +offline efficiency), ranger (+crit chance, +chest speed), mage (+mana and spell power, +XP gain).
- **Server:** the class is already server-owned (the profile row), so `summarize()` can fold the passives into the same derived numbers as gear and Idols (`gearEconomy` pattern), and the fight profile takes the combat passive; no save change. Changing class later: open (proposal: a gem price, never free, and not during a fight).
- **UI:** the Character window lists the class passives next to Luck and the other bonuses; the class picker (`ClassPickerDialog`) shows them.

## 2. Avatars are separate from the class
- **Decided: 8 avatars to choose from at sign-up, more to unlock later.** The avatar is purely visual: the portrait in the header, rankings and map preview.
- **Data:** additive nullable `profiles.avatar_id text` (a migration, existing players default to their class portrait), copied into `player_stats.avatar_id` for rankings (a public column in the grant). The server accepts an avatar only if it is a starter avatar or one the player has unlocked.
- **Unlocks (decided): server achievements.** Each extra avatar is the reward of an achievement, so the unlock cannot be faked by editing a save.
- **Art:** a new portrait set (8 starters, then the unlockables), same pixel style as the class heroes (`scripts/pixel/sprites_characters.py`, `STYLE.md`), one common size plus a selected-frame; add to the asset list of [16](16-landing-and-play-route.md).

## 3. Server achievements (draft, later)
Only a sketch so the data model is not painted into a corner:
- Catalog in code (`catalog/achievements.ts`): `{ id, title, description, condition tag, reward: avatar | title | none }`.
- Table `player_achievements (user_id, achievement_id, unlocked_at)`, additive, written only by the server (service role, `insert ... on conflict do nothing`), read by the owner. Counts, not the list, may appear in rankings.
- Evaluated **lazily on requests the server already handles** (save, fight win, chest, offline claim) by pure functions of the summary and ledger, so no cron and no extra calls on the free plan. Examples: first rebirth, Rat King defeated, every biome discovered, crafting level milestones, a Paragon level, an Idol at its cap.
- Open for the real design: points, categories, hidden achievements, titles, seasonal ones.

## 4. Glossary (draft, later)
An in-game encyclopedia generated from the catalogs (biomes, monsters, materials and their tiers, items, buildings, Idols), with entries unlocked by discovery (`discovered` biomes already exist; a bestiary with kill counts is on the ROADMAP). It replaces the static Guide text over time and is the content base of the later guided tutorial. Because the catalogs are data, the glossary is data too: no hand-written page per item.

## 5. Offline report rework (decided direction)
- **Today:** `OfflineDialog` (welcome-back window) shows what the away time paid; the cap is 8 h plus Night Watch and the efficiency 50 % plus Steward ([11](11-server-authority.md)).
- **Change:** show a **progress bar of away time against the cap** ("Away 6 h 20 m of 8 h"). When the bar is full, say so and show how much time was lost ("Capped: 4 h 10 m earned nothing") with a hint to Night Watch and Steward; the efficiency is a second marker on the same bar or a line under it. The numbers come from the same server claim that already caps the gap (`lib/offline/grant.ts`), so the dialog reads them from the answer instead of recomputing.
- **Also on the landing page** ([16](16-landing-and-play-route.md)): the signed-in visitor's Continue card shows the same bar for the time elapsed so far ("Away 3 h 05 m of 8 h"), so players see when their bank is full. This is a read-only value computed from the ledger anchor and the cap; it must not claim anything.

## 6. Open questions
1. Class passive values and the class-change price.
2. How many achievements to launch with, and which avatars are the unlockables.
3. Whether the glossary comes before or with the guided tutorial.
