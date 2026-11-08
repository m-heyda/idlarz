# Audit of the old docs (2026-11-08)

The old numbered docs were checked against the code. The ~60 wrong statements in them (castle 6 plus 100 tiles, the Ember `+6 %` rule, rats and the Rat King, old castle timers and click ladders, "Rattatui" sets, a rebirth keeping gear) were fixed by replacing those docs with this folder; the old files were deleted. The code-side findings were fixed in PR #113 (the heal gap, the stat tooltip, two stale comments and a stale doc pointer) or resolved by IDL-169 (building cost and Charisma). Three are **still open**, each with an issue:

1. `ticketCap` (`offline/tickets.ts`) estimates free land as `owned - 1 - buildings - ward` and does not subtract lakes (IDL-221).
2. Bosses are placed with a uniform pick while normal monsters are weighted by win chance (`placement.ts`); needs an owner decision (IDL-222).
3. The gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision (IDL-223).

The win-chance bucket and the three-defeat pause of the battle queue stay open as IDL-59.
