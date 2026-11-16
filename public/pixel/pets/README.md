# pets

- `kaczkawu_dog.png` (in this folder): **Yuki, special pet, reserved.** A one-off gift to the user **KaczkaWu** (the owner's girlfriend). Do not put it in any drop table, shop or random reward. Wired: `src/catalog/pets.ts` (the pet), `src/lib/offline/pets.ts` (the server grants it to the account in `YUKI_GRANT_USER_ID`, once), `src/components/game/pets/PetSprite.tsx` (walks around the castle and talks).

## New drops, not sorted yet

Sprite sheets the owner dropped here, none named by the code yet. Decide for each: wire it (a pet in `src/catalog/pets.ts`), move it to `reuse/pets/` (kept for later) or delete it.

| File | What |
| ---- | ---- |
| `brown-cute-pet-cat-walking-6a21-spritesheet.png` | a brown cat, walking |
| `cute-pet-hamster-walking-bb8b-spritesheet.png` | a hamster, walking |
| `dachshund-jumping-and-walking-running-forward-620e-spritesheet.png` | a dachshund, jumping, walking and running |
| `sprite-32x32px-6f-sheet.png` | a 6 frame 32x32 sheet (96x64) |

Rename the files to `<animal>_<what>.png` when you pick them.
