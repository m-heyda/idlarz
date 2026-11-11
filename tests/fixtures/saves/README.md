# Save fixtures

One real-shaped save and ledger row per **released** shape, made from the code of that release with `npm run gen-save-fixtures` (made-up data, a fixed clock, no real player). `tests/saves/saveFixtures.test.ts` loads every file here with the current code and asserts it is accepted and round-trips; that is the guard that today's code still reads what yesterday's wrote.

- `save-v<schema>-*.json`: `{ schema, note, text }`, `text` is the exact `IDLZ2.` save text.
- `ledger-v<n>-*.json`: `{ note, row }`, `row` is the `player_ledger` columns as the code wrote them.
- `released-ids.json`: every id the stored data can name (items, monsters, biome letters, ...), appended to with `npm run gen-save-fixtures -- --ids`, checked by `tests/saves/appendOnly.test.ts`.

**Never edit or delete a fixture to make a test pass.** A failing fixture means the change is not save-compatible: make it additive or write an upgrade (`docs/plan/save-compatibility.md`). A release that changes the shape adds new fixtures (the generator writes only files that do not exist yet) and keeps the old ones.
