# Known issues in the code

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Open code-side findings, each written as `@knownissue` on the code it is about. Fix the code, then delete the tag.

### [`REBIRTH`](progression.md#rebirth) — [`src/config/rebirth.ts:22`](../../src/config/rebirth.ts)

- IDL-223 the gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision.

### [`queueTicket`](combat.md#queueticket) — [`src/lib/offline/fightTargets.ts:88`](../../src/lib/offline/fightTargets.ts)

- IDL-59 the win-chance bucket and the three-defeat pause of the battle queue are still open.
