# Known issues in the code

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Open code-side findings, each written as `@knownissue` on the code it is about. Fix the code, then delete the tag.

### [`REBIRTH`](progression.md#rebirth) — [`src/config/rebirth.ts:22`](../../src/config/rebirth.ts)

- IDL-223 the gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision.

### [`placeTickets`](monsters.md#placetickets) — [`src/lib/offline/placement.ts:75`](../../src/lib/offline/placement.ts)

- IDL-222 bosses are never weighted by win chance (a uniform pick); needs an owner decision.

### [`ticketCap`](monsters.md#ticketcap) — [`src/lib/offline/tickets.ts:102`](../../src/lib/offline/tickets.ts)

- IDL-221 `ticketCap` estimates free land as `owned - 1 - buildings - ward` and does not subtract lakes.
