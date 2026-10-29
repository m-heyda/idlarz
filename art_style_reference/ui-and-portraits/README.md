# ui-and-portraits/ : avatars, skill icons and battle backgrounds

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first. Context: avatars are separate from classes ([docs/21](../../docs/21-classes-avatars-achievements-offline-report.md) section 2, RELEASE-PLAN P2.4); the fight screen has a background that may be reworked.

## 1. Files

| File | Contents | Use |
|---|---|---|
| `2r0s3O.jpg` | 48 **human and dwarf portraits** (men, women, beards, helmets, braids) in framed tiles | **8 starter avatars** (knight, druid, scout, scholar, miner, farmer, bard, alchemist) |
| `RagiwH.jpg` | 48 **orc, goblin and half-orc portraits** | unlockable avatars (achievement rewards) |
| `JnC0G_.jpg` (1.4 MB) | 48 **tiefling and demon portraits** (horns, red and purple skin) | unlockable avatars (Blight, late achievements) |
| `XxPWs5.jpg` | 48 **tiefling, elf and drow portraits** | unlockable avatars |
| `amYqsq.jpg` | 48 **mixed portraits**: skeletons, a scarecrow, witches, elves, a mage, a pirate, an ent | unlockable avatars (undead, fun ones) |
| `tlNDQD.jpg` | an **NPC**: an old woman and a robed monk with a coin bag, each as a full-body figure plus four portrait expressions | the merchant and NPC style; expression sets for dialogue |
| `AyKpuG.jpg` | 48 **skill icons** (beasts, paws, claws, eggs, spiders, a cat, a bear): bright coloured backgrounds with rays | future skills or buff icons |
| `gqT2A1.jpg` | 48 **tinkering and utility skill icons** (tools, gears, bombs, keys, ladders, hourglasses) | achievement, tutorial or ability icons |
| `tPlRC0.jpg` | 48 **dark skill icons** (blood, hooded figures, hearts, swords, spells) | Blight or Battlefield ability icons |
| `SfMkEx.jpg` (grey-lilac background) | **ability icon frames**: 4 coloured rows of simple glyph icons (pink, green, cyan, white) and a row of **14 skull colour variants** | a model for a **uniform icon family** and for glyph-style achievement or tier marks |
| `I4ZuLo.jpg` | **battle background "Terrace"**: a dark stone terrace with arches at dusk, bats | fight backdrop |
| `lN4Eqx.jpg` | **battle background "Throne Room"**: red-lit hall with a throne and candles | boss fight backdrop |
| `mM0Uyf.jpg` | **battle background "Dead Forest"**: graveyard, dead trees, blood-red sky | Blight and Battlefield fights |
| `muQL6L.jpg` | a **blue sky with white clouds** (parallax layer) | outdoor day fight sky |
| `_uMHtA.jpg` | a **pink and purple sunset sky with clouds** | dusk fight sky |

## 2. What we want

- **Avatars**: 8 starter portraits and unlockable ones, a coherent set in our bust style (40x40, framed, coloured outline) and **independent of class**. Use the human and dwarf set for starters; the orc, tiefling, drow and undead sets are the **unlockable** pool (each unlocked by a server achievement). A locked silhouette and a selected frame are also needed ([docs/16](../../docs/16-landing-and-play-route.md) section 4).
- **Battle screen**: maybe a reworked fight background. Today the fight modal has a plain scene; the references show a **backdrop plus an arena floor** layout that fits a 3/4 monster standing on the floor. Consider one backdrop per biome family (day sky outdoor, dusk, dark hall, dead forest for the two special biomes).
- **UI**: skill and ability icons for later (the two ability slots hold Heal and Stun today), plus an NPC style for quests and the merchant.

## 3. What agents should do with it later

1. **Avatars (P2.4)**: pick 8 faces from `2r0s3O.jpg` that read clearly at 40x40 and cover the working list (knight, druid, scout, scholar, miner, farmer, bard, alchemist); **recreate** them in the style of `scripts/pixel/sprites_characters.py` (big friendly heads, readable eyes, one signature prop) with the shared bust frame and level badge. A direct cut needs a cleared licence and our palette; the references are a different art direction (more realistic faces), so a redraw will usually be needed to sit next to the class heroes.
2. Unlockable avatars follow the same recipe later, from the other portrait sheets; tie each to an achievement in `catalog/achievements.ts`.
3. **Battle backgrounds**: treat them as layout and mood references (a backdrop band and a darker floor, a vignette). Draw our own at the fight modal's size, in the map's palette; do not use the references directly (different resolution and a heavy gradient look).
4. **Skill icons**: do not implement skills from these. If skills are added later, copy the **framing idea** (a coloured square, a glyph, a bright rim) into one consistent family.
5. Keep UI chrome rules from `scripts/pixel/reference/STYLE.md` (bevelled stone-maroon frames); these sheets do not override them.

## Provenance of anything cut from here

(none yet)
