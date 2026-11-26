# 22 · Glossary overlay and resource mastery: what is left

Reviewed against the code on 2026-11-26. **Built** (the code and its JSDoc are the record): unknown monsters drawn as black sprites until the first fight (`stats.seen`, `data-unknown`), the lifetime counters (`player_ledger.stats`), the **Bestiary** with kill tiers (10 / 100 / 500 / 2,500), boss tiers (1 / 5 / 25 / 100), structured mastery bonuses, biome goals and claims (`src/lib/bestiary/`, `BestiaryWindow.tsx`), and a golden-monster line in it. The old draft's reveal layers (100 / 200 / 300 / 400 kills) were replaced by the Bestiary tiers, and monster mastery is the Bestiary's claims, so both are gone from here.

What is open (Linear IDL-83 and IDL-84):

## 1. Glossary overlay for the rest (IDL-83)

A Glossary overlay with tabs for **Resources, Biomes, Items, Buildings and Idols**, generated from the catalogs (a new resource or item appears without a hand-written page). Unknown entries show as "???" with a hint of how to unlock them. Resources unlock when first owned; biomes follow `discovered`; items show their stat ranges after being found; buildings and Idols follow what has been built. The reading side needs no new endpoint: it reads the catalogs in the client plus the `stats` object the answers already carry (`statsVer`).

## 2. Resource mastery (IDL-84)

- **Decided:** at **1 million** of a resource earned its glossary entry fully unlocks; at **1 trillion** earned the player gets **+25 % income of that resource**, permanently (that resource only). Account-wide, survives rebirth, computed on the server from `stats.earned[resource]` (the verified gain of each accepted save), through `limitOf` / `HARD_LIMITS`.
- **Check before building:** a sim line with many resources mastered, against the Ember income bonus, so mastery cannot out-scale it.

## 3. Open questions

1. The resource ladder above 1 trillion (1 quadrillion ...), its reward and the per-resource cap.
2. What the glossary shows for Items, Buildings and Idols at each layer, and the tab order.
