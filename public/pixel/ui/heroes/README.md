# ui/heroes (20 avatar busts)

Framed 64x64 busts for the avatar picker (`src/catalog/avatars.ts`, picture = `AvatarInfo.portrait`, URL from `avatarArtUrl`). `tests/saves/avatars.test.ts` fails when an avatar points at a file that is not here. Made by the owner with Sprite Fusion on 2026-11-10 (and 2026-11-11 for the Beta tester); the avatar ids and unlock rules are in the code, the "Use" column is the intent when they were named.

Starters are candidates for the 8 starter avatars (IDL-71): human, elf and dwarf faces. The horned set is the unlockable pool (achievement rewards: Boss slayer, Reborn, and later biome unlocks). The final assignment of ids lives in `src/catalog/avatars.ts`.

| Old | File | What | Use |
| --- | ---- | ---- | ------------- |
| 1 | `avatar_dwarf_knight_orange_eyes.png` | dwarf in a plumed helmet, glowing orange eyes, stone frame | starter: Miner |
| 2 | `avatar_winged_helm_veteran.png` | grey-bearded veteran, winged helmet, bronze frame (65x65) | starter: Scholar |
| 3 | `avatar_purple_elf_lady.png` | elf lady in a purple and gold helm, purple frame | starter: Bard |
| 4 | `avatar_green_horned_elf.png` | elf in a green horned helm, green frame | starter: Druid |
| 5 | `avatar_red_plume_lady.png` | woman in a red-plumed helmet, red frame | starter: Scout |
| 6 | `avatar_gold_lion_knight.png` | knight in a gold lion helm, gold frame | unlockable: Architect |
| 7 | `avatar_chain_knight_woman.png` | woman in a chain coif and helmet, steel frame | starter: Farmer |
| 8 | `avatar_red_haired_knight.png` | red-haired knight in a steel helmet, chain frame | starter: Knight |
| 9 | `avatar_blue_plume_knight.png` | green-eyed knight with a blue plume, blue frame | starter: Alchemist |
| 11 | `avatar_horned_brute_dark.png` | scarred brute in a spiked dark helm with big horns | unlockable: Boss slayer |
| 12 | `avatar_horned_graybeard.png` | grey-bearded warrior in a horned helmet | unlockable pool |
| 13 | `avatar_horned_scarred_woman.png` | scarred woman in a horned helmet, red frame | unlockable: Reborn |
| 14 | `avatar_horned_ram_helm.png` | warrior with ram horns, teal frame | unlockable pool |
| 15 | `avatar_horned_fur_beard.png` | bearded warrior in fur, blue frame | unlockable pool |
| 17 | `avatar_horned_green_veteran.png` | veteran with curved horns, green frame | unlockable pool |
| 4324 | `avatar_horned_black_helm.png` | stern warrior in a black horned helm, purple frame | unlockable pool |
| 654654 | `avatar_horned_fur_collar.png` | warrior with a fur collar, red frame | unlockable pool |
| 34543543 | `avatar_horned_chainmail.png` | grizzled warrior in chainmail and horns, purple frame | unlockable: Early tester |
| new | `avatar_beta_tester.png` | wireframe hologram bust on a teal frame | unlockable: Beta tester (same achievement as Early tester) |

`avatar_admin.png` is the Admin avatar (id `admin`, only for the admin account): the Bard's purple frame with the first frame of `admin/admin_mark.png` at 2x on a dark violet field.

`avatar_admin_hooded.png` is the second admin-only avatar (id `admin_hooded`): a hooded figure with a question mark, added 2026-11-16.

Not named by any avatar yet (spare for later unlocks): `avatar_horned_black_helm`, `avatar_horned_fur_beard`, `avatar_horned_fur_collar`, `avatar_horned_graybeard`, `avatar_horned_green_veteran`, `avatar_horned_ram_helm`.

## Before it ships

`avatar_winged_helm_veteran.png` is 65x65: crop it to 64x64 if the frame is off by one pixel. Each avatar must stay readable at 20 px (HUD, ranking row).
