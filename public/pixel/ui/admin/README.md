# admin

`admin_mark.png` is the admin mark: an 8 frame sprite sheet (256x32, 32 px frames) of a small purple creature with a screen for a face, provided by the owner. The design system's `AdminMark` plays it next to the name of the admin account (`profiles.is_admin`) in the game, on the landing page and in the Rankings (`ADMIN_BADGE_PIC` in `src/catalog/badges.ts`). Its still frame is also the Admin avatar, `ui/heroes/avatar_admin.png`.

`badge_laptop.png` (32x32, still) is the second admin-only badge, id `admin_laptop` (`ADMIN_BADGE_LAPTOP` in `src/catalog/badges.ts`); the admin picks it or the octopus in the badge dialog. `ui/heroes/avatar_admin_hooded.png` is the second admin-only avatar (id `admin_hooded`). Both are offered and accepted only to the account that holds `ADMIN_UNLOCK` (`profiles.is_admin`).
