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

## 6. Introducing classes: a one-time progress reset (decided 2026-10-29)

When class bonuses and avatars ship, **every player's progress is reset once** and each player goes through the **class picker, the avatar picker and the initial tutorial again**, with their **name reserved**. The game is in testing (5 accounts at the time of writing, all with 0 rebirths and castle level 4 or lower), so a clean start is cheaper than migrating old runs into a system with different power sources.

- **Reserved names.** Today `profiles.character_name` is **not unique** (no constraint in `schema.sql`, only the 1-9 length check). The migration adds a case-insensitive unique index (`create unique index profiles_name_unique on profiles (lower(character_name))`); existing names are kept, and the migration first lists collisions (there should be none among 5 accounts; a collision means that player is asked to choose a new name at the reset screen). From then on a name is taken by its owner for good, also across future resets.
- **Epoch mechanism.** A constant `GAME_EPOCH` (starts at the epoch of the class release, e.g. 1) and a `profiles.epoch smallint not null default 0` column (additive migration `profiles_epoch.sql`). `/api/auth/me` returns `needsReset: true` when `profile.epoch < GAME_EPOCH`; the same mechanism serves any later wipe.
- **Flow.** After login a **"A new chapter" screen** (before `SaveHub`, so no old save is installed): explains the reset and what stays, shows the reserved name, then **class picker -> avatar picker -> initial tutorial** (the existing `ClassPickerDialog`, a new avatar picker, `Tutorial`), then a new game starts. A browser holding an old local save must not resurrect it: the local save and the "entered" marker are archived with `archiveForNewGame()` (the existing helper keeps the old text) and the cloud link is reset.
- **Server step (idempotent, one request `POST /api/auth/epoch`).** (1) **Archive**: copy the player's current `player_saves` state into `save_history` as a *pinned* row (so a rollback is possible and nothing is destroyed); (2) delete the player's `player_saves` (cascades `player_worlds`), `player_stats` rows and reset the `player_ledger` to a fresh row (new `run_id`, gems per the decision below); (3) write the chosen class and avatar and `epoch = GAME_EPOCH`. A repeated call changes nothing (the epoch is already current). Compare-and-swap on `ledger.ver` as in every other ledger write.
- **Rankings** start empty; `trusted` is recomputed for the fresh games.
- **What carries over (decided):** the account, the **reserved name** and the **gems balance** (a gift of 1000 never lost by a rebirth; keeping it avoids a "my purse vanished" complaint). Embers, the Ember shop, levels, gear, map and the farm reset. Every account that existed before the reset also gets a cosmetic **early tester avatar and title**, granted by the migration as an achievement ([section 3](#3-server-achievements-draft-later)).
- **Communication.** A banner in the game and on the landing page a few days before the release ("a new chapter is coming: classes, new biomes, crafting; progress will reset, names are kept"), and the release screen above. The reset happens together with the first release that contains classes **and** avatars, never before, so it happens only once for this feature set.
- **Compat and tests.** No save fields change; the reset deletes rows. Tests: the epoch gate in `authRoute` (needsReset true/false), the endpoint is idempotent, the archive row is created and pinned, a stale tab with an old save cannot upload over the fresh row (the pipeline's compare-and-swap on `rev` and `ledger.ver` already rejects it; add a test for the case where the row was deleted), unique-name collisions. Run the live-save dry run of [14](14-server-audit-and-data-plan.md) first to count affected rows.

## 7. Guided tutorial: replace the wall of text (roadmap item, designed)

**Today:** the Guide is one 402-line component (`overlays/Tutorial.tsx`, 17 sections from "Game Basics" to "Tips"), opened from Settings in a modal. It is a wall of text: everything at once, nothing tied to what the player has reached, no memory of what was read, and much of it describes features the player has not unlocked yet.

**Goal:** a **guided tutorial whose steps unlock together with the features and when the player discovers them**, and a Guide journal that only shows what has been unlocked. It also becomes the initial tutorial the class-release reset replays ([section 6](#6-introducing-classes-a-one-time-progress-reset-decided-2026-10-29)).

- **Content as data** (`catalog/tutorial.ts`): each step has `id`, the `feature` it belongs to, a `trigger` (a game event plus a condition: first click, first tile bought, first building, castle level 2, first monster appears, first chest, first fight won, rebirth available, merchant opened, farm unlocked, a biome discovered, first Idol, first road, crafting unlocked ...), a short text (one to three sentences, **numbers read from the config**, never typed in), an optional UI target to highlight, optional prerequisites and an optional "try it" completion check (e.g. "buy a tile"). No hand-written page per feature: a new feature or biome adds catalog entries, and the glossary ([section 4](#4-glossary-draft-later)) links to the same data.
- **Presentation:** small non-blocking coach tips next to the relevant control (a bottom sheet on phones) plus a `NotifyDot` on the Guide button when a new entry unlocks; the **Guide journal** lists unlocked entries with the full text, and shows locked ones as "???" with a hint of what unlocks them, which doubles as a gentle teaser of the game's depth. "Skip tutorial" and "Replay" are always available, and `prefers-reduced-motion` is respected.
- **The initial tutorial** (after class and avatar pick): a short linear path of about eight steps (click for gold, buy the first tile, build, buy an animal, start the castle upgrade, open a chest, fight the first monster, find the merchant) that ends with an achievement ([section 3](#3-server-achievements-draft-later)); later steps appear as features unlock.
- **State:** the set of seen/completed step ids as an optional list in the save core (`tutorial.seen`, additive, no schema bump; it is cosmetic, so it does not need the ledger). Triggers use the existing store/events; new biomes use the `discovered` set ([12](12-rebirth-biomes.md)).
- **Server:** nothing is needed, except the optional "tutorial finished" achievement.
- **Tests:** every step id is unique; every feature that unlocks has at least one step; every trigger names an event that exists; text templates only use keys that exist in the config; a snapshot of the unlock order so a reorder is deliberate.
- **Size and order:** M-L, most of it writing. It ships **after the reset flow** (it is its second half) and each later feature (biomes, buildings, crafting, rankings) adds its own steps in the same release. The old `Tutorial.tsx` is removed once every section has a catalog entry.

## 8. Open questions
1. Class passive values and the class-change price.
2. How many achievements to launch with, and which avatars are the unlockables.
3. Whether the glossary comes before or with the guided tutorial.
4. Date and announcement text for the reset; whether to keep the old save downloadable (an "export your old save" button on the new-chapter screen for a few weeks).
6. The tone and length of tutorial steps, and whether completing steps gives small rewards (gold, gems) or only the achievement.
