# Castle art

Supplied 64x64 sprites, drawn centred on the 48px castle tile (they spill 8px over the neighbours). No walls, no animation: the area and its bonus grow with the level, the sprite does not carry them.

| File | Used for |
| --- | --- |
| `castle_1.png` .. `castle_10.png` | the castle at upgrade level 1..10 (`castleIconName` in `src/config/pixelIcons.ts`, `CastleSprite.tsx`) |
| `castle_skin_1.png` .. `castle_skin_7.png` | **premium skins to sell for gems later** (plan: `docs/plan/30-gem-sinks.md`, premium castle skins). Not wired to anything yet; no shop, no save field |
| `castle_loading.png` | 640x64 strip of `castle_1..10` for the loading screen (`src/styles/LoadingScreen.css`). Rebuild it when a level sprite changes |

Skin look: `skin_1` ice lotus, `skin_2` ring fortress, `skin_3` dark crimson gothic, `skin_4` red pagoda, `skin_5` stone square keep, `skin_6` white and gold palace, `skin_7` white crystal.

Everything here is listed in Storybook under Assets > Buildings (levels as used, skins as planned).
