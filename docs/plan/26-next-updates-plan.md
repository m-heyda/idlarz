# 26 · Next updates: a rough draft of the direction

> **This is a DRAFT, not a source of truth.** It is a loose sketch of the direction after the New chapter release (0.3.0, `GAME_EPOCH` 2, shipped 2026-11-11). **Linear is the truth** (team IDL, projects R0-R12 and the Economy track). When this file and Linear disagree, Linear wins; when this file and the code disagree, the code (its JSDoc, `docs/reference/`) wins. We use it to pick and shape the next issues, then it goes stale on purpose: do not keep it in sync issue by issue. Rewritten 2026-11-11; the old phase A-E plan (core cleanup, item assets, loot pools, monsters) was mostly executed and is gone, see git history.

Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week. The game is **desktop only** (no mobile or phone layout, decided 2026-11-11).

## What is already done (so it does not come back as a task)

Core cleanup (store and config splits, fight engine split, pacing guard), the icon registry and item art passes 1-2, per-biome loot pools and the grade ladder G1-G3 live, bosses own their drops, the potion belt, bigger bags, monster discovery, classes with passives, class-locked avatars, achievements v1, the guided tutorial, landing and `/play`, the epoch flow and full reset, home-biome buildings with levels and Idols, live biomes at rebirth 1-5 (the unlock rule), the farm and castle rework, save-compatibility tooling, release notes in `content/changelog/`.

## Direction in four themes

Rough order, not a commitment. Each theme becomes a handful of Linear issues when we pick it.

### 1. Make the release solid (days)

- Post-release polish (IDL-255): the real-browser look (IDL-251), crafting window, bag and Drink flow, hub and chapter-screen copy.
- Watch the live reset: `chapter_archive_failed`, 409 `nameTaken`, 412 `stale_epoch`; run `npm run check-live-saves` again once players return.
- Small leftovers: Early tester wireframe set (IDL-282), hero creator polish (IDL-271, IDL-272), save-compat follow-ups (IDL-281, IDL-288), `profiles.player_class_known` CHECK (IDL-280).
- Keep `docs/plan` honest (this file, the ROADMAP and Linear stale-ticket sweeps).

### 2. Gems and trust (the biggest visible gap)

Every account starts with 1,000 gems and nothing spends them. The gem track of [30](30-gem-sinks.md): spend engine (IDL-189) first, then identity services (IDL-190), gem sources (IDL-194), the shop window (IDL-230), then convenience and time (IDL-191, IDL-192, IDL-234) and cap breaks later (IDL-231, IDL-232). In parallel, turn on server authority: `verify.ts` enforcement (IDL-208) and the server-run rebirth (IDL-211), which gate any public launch (IDL-126).

### 3. Depth in the fight and in the loot

Boss mechanics (IDL-257) and combat depth (IDL-204), then loot depth: new stats and affixes (IDL-176, IDL-45), the legendary model, roster and Vault (IDL-143, IDL-144, IDL-148, IDL-146), monster chests (IDL-163), golden monsters everywhere (IDL-56), battle backgrounds (IDL-161). Consumables beyond HP potions (IDL-40 and its children). Glossary and mastery (IDL-83, IDL-84) use the counters that now exist.

### 4. More world

The five rebirth biomes, Jungle first (data IDL-107, art IDL-106; `discovered[]` and the new biome codes IDL-87 are on its critical path), then Fields and Orchard, then Blight and Battlefield. Building art (IDL-99, IDL-245). Crafting v1 with the new materials (IDL-152, IDL-226, IDL-235, IDL-151). Rankings and the preview map (IDL-113, IDL-115). Paragon and the +20 attribute points (IDL-100, IDL-186, IDL-187). Offline report bar (IDL-64).

## Still to brainstorm before building

Long-game scaling after 5+ rebirths (IDL-277), the balance pass after all recent changes (IDL-276, IDL-275), gem sinks with exponential growth (IDL-278), the skill tree (IDL-202), self-completing and daily quests (IDL-203), legendary acquisition and persistence (IDL-146), crafting item classes (IDL-226), the reward model for monsters (IDL-52), more farm animals (IDL-260).

## Art

Item art pass 3 (replace placeholders with Sprite Fusion, IDL-218, IDL-33 to IDL-36) and the building and biome art run beside the features and never block a release. New pictures are made in Sprite Fusion (see `CLAUDE.md`).

## Loot grades by biome (kept because the code points here)

The grade windows a biome's normal monsters may drop, decided in the old phase C1: plains G1-G3, forest G2-G4, swamp G3-G5, tundra G5-G7. G1-G3 are live; G4-G6 go live with the forest, swamp and tundra work, G7-G9, the special sets S1-S3 and the legendary roster are kept for the five rebirth biomes (see [31](31-grade-by-biome-and-source.md) and [28](28-reuse-items-and-stats.md)). The item ladder is data in `src/catalog/items/`; the grade is a tag (`grade:G3`), never an id.
