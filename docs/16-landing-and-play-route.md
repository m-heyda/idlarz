# 16 · Landing page, `/play` route and account polish (design draft, nothing built)

End goal: a public landing page with a generated map that slowly scrolls up out of a hills range carrying the game's name, a windowed login/register overlay, short game descriptions, and the game itself behind an authenticated `/play` route.

## 1. What exists
- `src/app/page.tsx` (route `/`) is a client component that is both the gate and the game: `fetchMe()` -> `StartDialog` (login/register, character name, one of four heroes) -> `SaveHub` -> `GameApp` (dynamic import, `ssr: false`).
- Auth is cookie-based and server-only: `createSupabaseServer()` in `lib/supabase/server.ts` (httpOnly cookies, `@supabase/ssr`), routes `/api/auth/{login,register,logout,me,profile}`. The browser never talks to Supabase.
- There is no `middleware.ts`; every protection is the API routes answering 401, plus the client gate.
- Art: `public/pixel/{bg,icons,terrain,ui}`; the terrain renderer (`lib/terrainRenderer.ts`, `TerrainLayer`) draws any `World`; `utils/growWorld.ts` builds a seeded world with `rollBiome`.

## 2. Routes
| Route | Content | Access |
|---|---|---|
| `/` | landing page (server-rendered shell + client canvas) | public |
| `/play` | the existing gate + game, moved as is (`page.tsx` logic -> `app/play/page.tsx`) | **auth-protected** |
| `/api/*` | unchanged | unchanged |

Protection, in two layers: (1) a `middleware.ts` matcher on `/play` that refreshes the Supabase session through `@supabase/ssr` (`getUser()`, which also rotates cookies) and redirects to `/?login=1&next=/play` when there is no user; (2) the `/play` page keeps the client gate (profile missing -> profile form, outage -> retry screen), because middleware cannot see the profile row without a query. API routes keep returning 401 themselves: middleware is a convenience, not the security boundary. `getUser()` costs one auth request per navigation to `/play` only (not per API call). Logout returns to `/`. The localStorage "entered" marker (`readEntered`/`writeEntered`) stays.

## 3. The landing page
- **Background**: a procedurally generated map rendered with the real terrain pipeline, **seeded and deterministic** (`growWorld` with a fixed seed, all biomes unlocked including the new ones from [12](12-rebirth-biomes.md)), so the landing shows what the game offers. Layout: the title **"IDLE"** spelled out big in hills tiles at the bottom with **"REALM"** smaller underneath (decided name; a hills biome patch shaped like the letters, drawn with the same dual-grid renderer), and the camera slowly pans **bottom to top** (about 12-15 tiles per minute, loops back with a crossfade after the farthest biomes) revealing swamp, tundra, coast, then the rebirth biomes, with ambient critters (`AmbientLife`) and water animation (`WaterLayer`) running.
- **Overlay**: a centred `PixelModal` window with two tabs, **Login** and **Create account** (the existing `StartDialog` content, split from the gate so both pages share it), plus a left/right column of short feature cards: *Grow your land*, *Rebirth to unlock new worlds*, *Fight and loot*, *Craft legendary gear*, *Climb the rankings* (each two lines, one pixel icon). The window collapses to a bottom sheet on phones.
- **Performance / cost**: render the background to a single canvas from a **pre-baked tile image** (build step: `npm run landing:bake` writes `public/landing/map.webp`, tall strip), then a CSS transform animates it. This avoids running the world generator and 550 React tiles on a page that has no game, keeps the first paint small and costs the free plan nothing (static file). Respect `prefers-reduced-motion` (static frame). Lazy-load the game bundle only on `/play`.
- **SEO/meta**: title, description, Open Graph image (a crop of the baked map), `robots` allow.
- **Assets to produce**: baked strip (needs rebirth-biome art first, so ship a first version with the 7 current biomes and re-bake later), the title lettering pattern, 5 small feature icons.

## 4. Login / register / avatar polish
- Split `StartDialog` into a form component and its frame so the landing overlay and `/play` fallbacks share it. Keep the validation in `lib/authValidation.ts`.
- **Class and avatar are separate (decided):** the class (warrior, paladin, ranger, mage) is for small bonuses; the avatar is a visual portrait chosen from **8 starters**, with more unlocked by server achievements ([21](21-classes-avatars-achievements-offline-report.md)). Sign-up asks for name, class and avatar. Needed assets: the 8 portraits at one size, a selected frame and hover state, and a locked-silhouette for the unlockables.
- Error and loading states with the pixel UI kit (`ui_art.py`): field errors, "accounts unavailable" (`AuthUnavailable`), password rules shown up front.
- **Password reset: on. Email confirmation: off while the game is in testing** (decided). Needs the project's email sender configured; the free tier sends only a few emails per hour, so a "reset" request is rate-limited per account and per IP in the route. Turn confirmation on before a public release.

## 5. Rollout
1. Move the gate to `/play` (no behaviour change), add middleware, redirect `/` -> `/play` for signed-in visitors (optional "Continue" button instead).
2. Landing page with a static first background.
3. Baked animated map, feature cards, polish and avatar assets.
Each step is deployable alone. Risk to check: the cookie `sameSite: 'lax'` + redirects keep sessions across `/` and `/play`; Vercel preview URLs need the Supabase redirect list updated if email confirmation is used.

## 6. Decisions and open questions

**Decided (2026-10-29):**
- **Name: IDLE REALM.** The banner spells a big **IDLE** in hills tiles (all straight strokes: I, D, L, E), with **REALM** smaller underneath. The name lives in one constant (`config/branding.ts`: `GAME_TITLE`, used by `layout.tsx` metadata, the landing, the Guide and the README; today's metadata still says "Idle Explorer"), so a rename is a one-line change plus a re-bake of the landing strip.
- **Signed in at `/`:** the landing with a **Continue** button, plus a small **character card**: name, avatar, class, level and Paragon, rebirths, and a **bar of the time away against the offline cap** (read-only, never claims; [21](21-classes-avatars-achievements-offline-report.md) section 5). The data comes from one extended `/api/auth/me` answer (profile plus the `player_stats` row plus the ledger anchor and the cap), so the landing costs at most two small reads for a signed-in visitor and none for a guest.
- Password reset on, email confirmation off for now; avatars and classes separate (section 4).

**Still open:**
1. Final wording of the feature cards and the order of the biomes in the scroll.
2. Whether the landing shows a public "players online / total rebirths" number (needs a cached count; not in the first version).
