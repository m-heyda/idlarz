# 15 · Preview map of another player's world (draft; the Rankings are built)

The Rankings window is built (migration `player_rankings`, `GET /api/rankings`, six boards: Level, Rebirths, Crafting, Tiles, Kills and Deeds; Quests is a coming-soon tab) and is described by the JSDoc of `src/lib/rankings.ts`, `rankingsServer.ts` and the SQL in `supabase/migrations/player_rankings*.sql`. What is left is the **preview**: a player can peek at another player's generated world (biome layout and castle location only), from the eye icon of a Rankings row. Linear: IDL-115.

## What is planned

Goal: a read-only look at another player's world: biomes and castle only, in a clear "Previewing <name>" mode with a close button.

- **Data**: `land` (letters) is biome-only and `extra` holds buildings/levels/chests, so the response contains **`land` only** plus the castle position (fixed at `CASTLE_X, CASTLE_Y`). That also hides how far the owner has built or what they own. 1.2-1.5 KB per map today (kB-scale even at 50,000 tiles).
- **Access**: `player_worlds` stays select-own. Add a route `GET /api/world/<token>` using the service role, which (a) returns `land` for a **trusted/listed** player only, (b) rate-limits per caller (a handful per minute), (c) answers with `Cache-Control: private, max-age=300`. The token is the ranking row's opaque id, never an auth id the client can enumerate. This avoids a public policy on a big table, and keeps the cost to one primary-key read.
- **Client**: a `previewStore` separate from `gameStore` (so the preview can never touch or save the real game): `{ owner: {name, class}, tiles }`. The map view reads tiles from the preview store while `mode === 'preview'`; economy, autosave, `useSpawnSync`, fights and polling are **paused** and the cloud sync is blocked (`useCloudSync` must not run, otherwise the preview could overwrite the player's own save: this is the one dangerous bug to test). A banner and a "Close preview" button return to the real game; Esc closes it too.
- **Rendering**: reuse `TerrainLayer`, `Minimap` and the biome art with an empty building/monster layer; the world is built with `packLand`'s inverse (`worldFromPart` in `lib/offline/placement.ts` already does it).
- **Tests**: preview store has no path to `saveStorage`; a route test that `extra` never leaves the server; a rate-limit test.

## Decided

- Only **trusted** players can be previewed (`trusted` on `player_stats`); a player who opts out of the rankings (a `listed` switch in Settings, not built yet) has no ranking row and cannot be previewed. The preview route checks both.
- The preview returns `land` only (never `extra`, so buildings, levels and chests stay private) and needs the avatar and name from the ranking row; no account id leaves the server (an opaque token).
