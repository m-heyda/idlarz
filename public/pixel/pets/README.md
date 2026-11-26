# pets

- `kaczkawu_dog.png` (in this folder): **Yuki, special pet, reserved.** A one-off gift to the user **KaczkaWu** (the owner's girlfriend). Do not put it in any drop table, shop or random reward. Wired: `src/catalog/pets.ts` (the pet), `src/lib/offline/pets.ts` (the server grants it to the account in `YUKI_GRANT_USER_ID`, once), `src/components/game/pets/PetSprite.tsx` (walks around the castle and talks).

## Pets to unlock later (shown greyed in the Pets tab)

Walking sprite sheets of the pets players will unlock with achievements. For now they are only pictures: the Pets tab shows the first frame of each, greyed with "Coming soon" (`LOCKED_PETS` in `src/catalog/pets.ts`, not pets of the catalog: nothing can own or grant them). When one becomes real, add it to `PETS` with its own id and remove it from `LOCKED_PETS`.

| File | What | Frames |
| ---- | ---- | ------ |
| `cat_walk.png` | a brown cat, walking | 8 of 64x64 in a row |
| `hamster_walk.png` | a hamster, walking | 8 of 64x64 in a row |
| `dachshund_walk.png` | a dachshund, jumping, walking and running | 8 of 64x64 in a row |
| `rabbit_sheet.png` | a white rabbit | 6 of 32x32 (3 x 2) |
