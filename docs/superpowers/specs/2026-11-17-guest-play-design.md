# Play as Guest (design)

**Status:** approved by the owner in chat, 2026-11-17 (approach A, full local loop).

## Intent
A visitor can try the real game from the landing page without registering. The session is temporary and lives only in this browser. It must show the real mechanics (spawns, fights, chests, loot, crafting, gems, rebirth, offline progress) while costing the server nothing and never touching the database, the rankings or any gameplay API.

## Goals
- Big gold "Play as Guest" button under the login/register form.
- Guests run the **real** server step functions (`src/lib/offline/online.ts`, `claimOffline`) in the browser against local repositories ("mini-server"). No second copy of any rule.
- Persistent top-right chip: progress is saved in this browser only; its Register button discards the guest game and opens registration (fresh start).
- Coming back later shows the real "While you were away" report, computed locally.

## Non-goals / anti-goals
- No guest data on the server, no anonymous Supabase users, no import of guest progress into an account.
- No save-schema change; guest-ness is out of band (route + key namespace).
- Cheating in guest mode is accepted (seeded RNG, local ledger): that is why nothing of it may ever reach the server.

## Approaches considered
- **A. Local mini-server (chosen):** a transport swapped into `post()` in `rewardsClient.ts`, dispatching to the real step functions with `localStorage`-backed ledger and a save repo that reads the live game store.
- B. Re-implement the loop client side: duplicates rules, drifts. Rejected.
- C. Server-side guest accounts: breaks the no-DB/no-API goal and invites abuse. Rejected.

## Design
- `src/lib/guest/`: `localRepos.ts` (ledger in localStorage, save repo built from the live store, in-memory identity repo), `dispatch.ts` (`guestTransport(path, body)` returning an HTTP-like `{status, body}`), `index.ts` (`installGuest`, `clearGuest`).
- `rewardsClient.ts`, `offlineClient.ts`, `rebirthClient.ts` call a registered transport instead of `fetch` while guest mode is on (`src/lib/guestMode.ts`). The client code never imports the guest engine; `/guest` loads it with a dynamic import, so ordinary players do not download it.
- `src/lib/offline/seal.ts` and `cloudSave/pipeline.ts` stop importing `node:crypto`; a small pure SHA-256/HMAC (`src/lib/sha256.ts`) gives byte-identical results (tested against node) so the engine can be bundled for the browser.
- Storage isolation: `/guest` is a separate route reached by a full page load; `storageScope.ts` appends `.guest` to every game key there, so guest data never collides with an account's save and the "unlinked local save belongs to the current player" rule is never triggered.
- `/guest` page: name and class picker, then `GameApp` in guest mode (no cloud sync, no `/api/auth/*`, no rankings fetch, no avatar/badge, no rebirth history).
- Chip: fixed top-right, "Guest: progress is saved in this browser only" + Register (clears guest keys, goes to `/?register=1`).

## Left to the builder
Exact copy text, chip styling, which windows show a "register to use this" state, test layout.
