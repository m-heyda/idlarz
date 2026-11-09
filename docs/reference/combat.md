# Combat

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The player's numbers, the server's fight engine, auto-battle, skills and win chance.

**Contents**

- Overview: [Combat overview and tunables](#combat)
- Player numbers: [`maxHp`](#maxhp), [`armorReduction`](#armorreduction), [`WEAPON_ATTACK_SPEED`](#weapon-attack-speed), [`damagePerHit`](#damageperhit), [`attacksPerSecond`](#attackspersecond), [`critOdds`](#critodds), [`swing`](#swing), [`armorOf`](#armorof), [`dodgeChance`](#dodgechance), [`lifeLeechPercent`](#lifeleechpercent), [`regen`](#regen), [`mitigate`](#mitigate)
- A fight: [`runCombat`](#runcombat), [`pickTarget`](#picktarget), [`queueTicket`](#queueticket), [`autoBattleUnlocked`](#autobattleunlocked), [`playerProfile`](#playerprofile), [`fightStep`](#fightstep), [`endFight`](#endfight), [`engage`](#engage), [`dismissTicket`](#dismissticket), [`projectFight`](#projectfight), [`payKill`](#paykill), [`rngFor`](#rngfor)
- Win chance: [`estimateWin`](#estimatewin)
- Potions and skills: [`healAmount`](#healamount), [`autoUse`](#autouse), [`SKILLS`](#skills)
- Results and rest: [`restThrough`](#restthrough), [`UNCLAIMED_SEC`](#unclaimed-sec)
- Consumables: [`BUFF_FAMILIES`](#buff-families), [`MAX_ACTIVE_BUFFS`](#max-active-buffs), [`readBuffs`](#readbuffs), [`addBuff`](#addbuff), [`buffTotals`](#bufftotals), [`drink`](#drink), [`withBuffs`](#withbuffs), [`applyUse`](#applyuse)

## Overview

<a id="combat"></a>

### Combat overview and tunables

Source: [`src/config/combatConfig.ts:20`](../../src/config/combatConfig.ts)

Combat tunables. Fights run on the server; the browser only asks for a fight and draws the answer. Everything a fight needs is frozen into a `PlayerProfile` when the fight starts
([`playerProfile`](combat.md#playerprofile), built from the last accepted save and the ledger's gear).

Where things live: this config (`COMBAT`, `STAT_RULES`), the pure rules in `src/lib/combat.ts`, the engine in `src/lib/offline/fight*.ts`, the win estimate in `src/lib/offline/winChance.ts`,
skills in `src/catalog/skills.ts` and `src/lib/skills.ts`. Monsters and their numbers: [`MONSTERS`](monsters.md#monsters). Drops: [`generateLoot`](loot.md#generateloot).

See also: [`maxHp`](combat.md#maxhp), [`runCombat`](combat.md#runcombat), [`estimateWin`](combat.md#estimatewin), [`MONSTERS`](monsters.md#monsters)

## Player numbers

<a id="maxhp"></a>

### `maxHp` <small>function</small>

Source: [`src/lib/combat.ts:34`](../../src/lib/combat.ts)

The player's numbers (all pure functions in `src/lib/combat.ts`, used by the server engine and the UI):

| Number | Formula |
| --- | --- |
| Max HP | `round((85 + 3 x Vitality + 0.25 x Charisma + gear Max HP) x (1 + set Max HP% / 100))`, 101 for a new character ([`maxHp`](combat.md#maxhp)) |
| Damage per hit | `max(1, round1(gear damage x (1 + attribute% / 100 + merchant% / 100) x (1 + set damage% / 100)))` ([`damagePerHit`](combat.md#damageperhit)) |
| Attribute damage % | Strength: 2% per point above 5 (physical weapons, bare hands). Intelligence: 2.4% per point above 5 (staff, wand) (`STAT_RULES`, `src/lib/statBonuses.ts`) |
| Attacks per second | `weapon speed x (1 + (0.25% x (Dexterity - 5) + Quick Hands%) / 100)`, 1 bare-handed ([`attacksPerSecond`](combat.md#attackspersecond); speeds in [`WEAPON_ATTACK_SPEED`](combat.md#weapon-attack-speed)) |
| Crit chance | `0.25 x Dexterity + 0.5 x Charisma + gear + Keen Eye`, capped at 75% ([`critOdds`](combat.md#critodds)) |
| Super-crit chance | `5% + gear Super Crit + Deadly Aim`, capped at 50%, rolled only when a hit already crit |
| Crit multipliers | crit x2, super crit x5, each times `1 + (Str-5 x 1 + Dex-5 x 0.5 + Cha-5 x 0.5) / 100` ([`swing`](combat.md#swing)) |
| Armor | gear armor + 0.5 x (Dex-5) + 0.5 x (Vit-5) + 0.25 x (Str-5) ([`armorOf`](combat.md#armorof)) |
| Dodge | gear Dodge, capped at 40% ([`dodgeChance`](combat.md#dodgechance)) |
| Life leech | gear + Vampiric Fang, capped at 15% of damage dealt ([`lifeLeechPercent`](combat.md#lifeleechpercent)) |
| HP regen | 1 HP/s with no fight open (`COMBAT.regenPerSec`); during a fight only gear Regen + Second Wind ([`regen`](combat.md#regen)) |
| Mana | max `20 + 4 x Intelligence + gear`; regen `0.5 + 0.05 x Intelligence + gear` per second (`STAT_RULES.mana`) |

A new character has 40 mana.

See also: [`armorReduction`](combat.md#armorreduction), [`damagePerHit`](combat.md#damageperhit), [`critOdds`](combat.md#critodds)

<a id="armorreduction"></a>

### `armorReduction` <small>function</small>

Source: [`src/lib/combat.ts:190`](../../src/lib/combat.ts)

The share (0-0.75) of a hit that `armor` takes away: armor / (armor + K) up to 50 %, then every further point counts half as much,
so no amount of armor makes anything unkillable (the asymptote is 75 %).

Armor reduction: `r = armor / (armor + 40)`; up to 50% the reduction is `r`, above that every extra point counts half, so the ceiling is 75%
(`COMBAT.armorK`, `armorSoftCap`, `armorSoftSlope`). A monster hit does `max(1, round(attack x (1 - reduction)))` ([`mitigate`](combat.md#mitigate)). The same curve is used for the player's armor and for monster armor.

**Formula**

```text
r         = armor / (armor + 40)
reduction = r                         if r <= 0.5
          = 0.5 + (r - 0.5) x 0.5     above that       (ceiling 0.75)
```

<a id="weapon-attack-speed"></a>

### `WEAPON_ATTACK_SPEED` <small>const</small>

Source: [`src/catalog/weapons.ts:13`](../../src/catalog/weapons.ts)

Attacks per second of a one-hand weapon by type (a plain weapon uses its type's speed; an item can override it with
`attackSpeed`). Light weapons swing fast, heavy ones slowly. Server fights swing at this speed (lib/offline/profile.ts),
together with each weapon's damage per hit.

Attacks per second of each weapon type: dagger 1.6, wand 1.3, sword 1.2, spear 1.1, bow 1, axe 1, staff 0.9, crossbow 0.8, mace 0.8, maul 0.6. Used by the item builders and [`attacksPerSecond`](combat.md#attackspersecond).

<a id="damageperhit"></a>

### `damagePerHit` <small>function</small>

Source: [`src/lib/combat.ts:92`](../../src/lib/combat.ts)

Damage of one swing (before crits): the gear's total damage times the attribute bonus of the weapon's type (1 without a weapon) and the set's percent damage.

<a id="attackspersecond"></a>

### `attacksPerSecond` <small>function</small>

Source: [`src/lib/combat.ts:103`](../../src/lib/combat.ts)

Attacks per second: the weapon's speed (1 bare-handed), the Dexterity bonus and the merchant's. The fight swings at exactly this speed.

<a id="critodds"></a>

### `critOdds` <small>function</small>

Source: [`src/lib/combat.ts:122`](../../src/lib/combat.ts)

Chance (0-1) that a swing crits, and that a crit becomes a super crit: character crit plus gear.

<a id="swing"></a>

### `swing` <small>function</small>

Source: [`src/lib/combat.ts:140`](../../src/lib/combat.ts)

One swing: `hit` damage, times the crit or super crit multiplier when the roll says so (high rolls crit, so a stubbed rng() of 0 never
does). Two random numbers at most (the second only on a crit). The server's fight engine and `rollHit` share it.

**Formula**

```text
crit    = hit x 2 x critExtra          super crit (rolled only after a crit) = hit x 5 x critExtra
critExtra = 1 + (Str-5 x 1 + Dex-5 x 0.5 + Cha-5 x 0.5) / 100
```

<a id="armorof"></a>

### `armorOf` <small>function</small>

Source: [`src/lib/combat.ts:159`](../../src/lib/combat.ts)

Armor against monster hits: the gear's plus (when the attributes are given) what Dexterity, Vitality and Strength add.

<a id="dodgechance"></a>

### `dodgeChance` <small>function</small>

Source: [`src/lib/combat.ts:222`](../../src/lib/combat.ts)

Chance (0-1) that a monster's hit misses: the gear's Dodge, capped.

<a id="lifeleechpercent"></a>

### `lifeLeechPercent` <small>function</small>

Source: [`src/lib/combat.ts:173`](../../src/lib/combat.ts)

The Life Leech in %, the gear's and the merchant's together, never above the cap.

<a id="regen"></a>

### `regen` <small>function</small>

Source: [`src/lib/combat.ts:211`](../../src/lib/combat.ts)

HP regeneration outside fights: the base rate plus the gear's regen stat.

<a id="mitigate"></a>

### `mitigate` <small>function</small>

Source: [`src/lib/combat.ts:203`](../../src/lib/combat.ts)

Damage of one monster hit after armor: `max(1, round(raw x (1 - armorReduction(armor))))`.

## A fight

<a id="runcombat"></a>

### `runCombat` <small>function</small>

Source: [`src/lib/offline/fight.ts:61`](../../src/lib/offline/fight.ts)

Brings the player's combat up to `env.nowSec`, then applies what the player asked for (switches, hotkeys) and starts the next fight when
auto-battle allows. Returns the new ledger. All events are in `ledger.combat.log`.

A fight. `runCombat` fast-forwards the player's combat to the server clock in 0.1 s ticks (`COMBAT.tickSec`) on every request; at most 120 s of fighting per request
(`maxCatchUpSec`), then it reports `behind`.

Per tick ([`fightStep`](combat.md#fightstep)):

1. HP and mana regenerate, cooldowns run, the boss clock runs, auto-use may act.
2. The player swings every `1 / attacks per second`. A swing rolls crit, then super crit ([`swing`](combat.md#swing); two random numbers at most). Damage to the monster is `max(1, round1(hit x (1 - armorReduction(monster armor))))`.
   Life leech heals `damage x leech%`.
3. If the monster is dead the kill is paid ([`payKill`](combat.md#paykill)) and the fight closes.
4. The monster swings every `1 / attackSpeed` (a stunned monster's timer does not advance). Dodge is rolled first; a monster crit uses its `critChance` and `critMult` (1.5).
5. At 0 HP the fight ends `defeated`: HP is set to 30% of max (`knockoutHpFraction`). If the boss clock reaches 0, or a fight lasts 180 s (`maxFightSec`), it ends `timeout`.
   Neither costs anything; the monster stays. `retreat` (switching auto-battle off) also keeps it.

The random stream is sealed per swing ([`rngFor`](combat.md#rngfor)), so a fight is a pure function of profile, ticket and secret. `tests/combat/goldenFight.test.ts` pins the engine to recorded fights;
`tests/combat/fightBalance.test.ts` pins the plains boss tuning; `npm run fight-sim` and `npm run monster-ladder` print which gear beats which monster (`docs/generated/`).

See also: [`fightStep`](combat.md#fightstep), [`estimateWin`](combat.md#estimatewin), [`restThrough`](combat.md#restthrough)

<a id="picktarget"></a>

### `pickTarget` <small>function</small>

Source: [`src/lib/offline/fightTargets.ts:41`](../../src/lib/offline/fightTargets.ts)

The next monster to engage: placed normal monsters first (the weakest, or the oldest: COMBAT.auto.engageOrder), then the boss. One that
beat the player is left alone until its retry time has passed, so an unbeatable monster never blocks the easy ones.

Starting a fight.

- **Click** on a monster (`CombatCommand` `fight`): fights it at once whatever the HP, the retry time, and with auto-battle on or off. Refused with a fight open (it queues instead), at 0 HP, or while the server is `behind`.
- **Auto-battle** (switch, default off, locked until the first rebirth: `COMBAT.auto.minRebirths` = 1, [`autoBattleUnlocked`](combat.md#autobattleunlocked)): when HP is at least 80% of max (`resumeHpPct`) the server picks the next placed monster:
  weakest level first (`engageOrder`), normal monsters before a boss, skipping any monster whose win chance is below 0.5 (`minWinChance`) or whose retry time has not passed.
  A monster that beat the player (or timed out) waits 300 s (a boss 600 s) (`retryCooldownSec`, `bossRetryCooldownSec`). See also [`engage`](combat.md#engage).
- **Dismiss** removes a monster for good (no loot), not allowed for the monster being fought ([`dismissTicket`](combat.md#dismissticket)).

See also: [`engage`](combat.md#engage), [`queueTicket`](combat.md#queueticket)

<a id="queueticket"></a>

### `queueTicket` <small>function</small>

Source: [`src/lib/offline/fightTargets.ts:88`](../../src/lib/offline/fightTargets.ts)

A click while a fight is open: the monster joins the queue, or leaves it when it was already there.

The battle queue: a click on another monster while a fight is open (or while resting for the next queued one) queues it; clicking it again removes it. Size `LIMITS.battleQueue` = 10 (hard 16).
The queue's head starts as soon as HP is back at 80%, ignoring retry time and win estimate; it works before the first rebirth; it is cleared by a defeat, timeout, retreat, rebirth or an absence, kept by a win.

**Known issues**

- IDL-59 the win-chance bucket and the three-defeat pause of the battle queue are still open.

See also: [`engage`](combat.md#engage), [`endFight`](combat.md#endfight)

<a id="autobattleunlocked"></a>

### `autoBattleUnlocked` <small>function</small>

Source: [`src/lib/combat.ts:45`](../../src/lib/combat.ts)

Auto-battle (the server picking the next monster) is a reward for the first rebirth; a click on a monster starts a fight from the start.

<a id="playerprofile"></a>

### `playerProfile` <small>function</small>

Source: [`src/lib/offline/profile.ts:62`](../../src/lib/offline/profile.ts)

Freezes everything a fight needs about the player into a `PlayerProfile` (max HP and mana, damage per hit, crit odds, attack speed, armor, dodge, leech, regen), from the last accepted save and the ledger's gear.

<a id="fightstep"></a>

### `fightStep` <small>function</small>

Source: [`src/lib/offline/fightSteps.ts:106`](../../src/lib/offline/fightSteps.ts)

One tick of the open fight. Returns when the fight ended.

One tick of the open fight, in the order of the numbered list on [`runCombat`](combat.md#runcombat).

<a id="endfight"></a>

### `endFight` <small>function</small>

Source: [`src/lib/offline/fightSteps.ts:86`](../../src/lib/offline/fightSteps.ts)

Closes the open fight as `defeated`, `timeout` or `retreat`: a defeat sets HP to 30% of max, a defeat or timeout starts the monster's retry cooldown (300 s, a boss 600 s) and the queue is cleared; the monster stays on the map.

<a id="engage"></a>

### `engage` <small>function</small>

Source: [`src/lib/offline/fightTargets.ts:113`](../../src/lib/offline/fightTargets.ts)

The next fight: the queue's head (the player chose it, so no retry time and no win estimate stop it, but the hero must be back on his feet), then auto-battle's pick.

<a id="dismissticket"></a>

### `dismissTicket` <small>function</small>

Source: [`src/lib/offline/fight.ts:145`](../../src/lib/offline/fight.ts)

Takes a monster off the map without a fight (a monster that cannot be beaten, or that is in the way). Ends the fight against it.

<a id="projectfight"></a>

### `projectFight` <small>function</small>

Source: [`src/lib/offline/fightProject.ts:32`](../../src/lib/offline/fightProject.ts)

The open fight carried to its end with the same ticks the real request would take (so the real result is the same unless the player
commands something first), as the picture the browser animates: HP of both sides and the hero's mana about once a second, and the swings and
spells to fly.
Nothing of the ledger is written. Returns null with no fight open or one that does not end within `COMBAT.maxFightSec`.

<a id="paykill"></a>

### `payKill` <small>function</small>

Source: [`src/lib/offline/reward.ts:35`](../../src/lib/offline/reward.ts)

Pays the kill of ticket `n`: the ticket leaves the bank, the roll is sealed on the number of kills this run (so a replay cannot roll
it again), and the gold, XP and hide go into what the server has granted. Null when the ticket is not there.

The kill is paid from the ticket's spawn level and age ([`levelAtAge`](monsters.md#levelatage)), never from a level the client claims; the roll is sealed on the number of kills this run ([`sealedRng`](saves-and-server.md#sealedrng)).

<a id="rngfor"></a>

### `rngFor` <small>function</small>

Source: [`src/lib/offline/fightContext.ts:81`](../../src/lib/offline/fightContext.ts)

The next random stream of a fight: sealed on the secret, the user, the run and the fight's ordinal, one draw per call.

## Win chance

<a id="estimatewin"></a>

### `estimateWin` <small>function</small>

Source: [`src/lib/offline/winChance.ts:60`](../../src/lib/offline/winChance.ts)

The player's chance against a monster of this type and level, starting with `hp` and with these potions to drink. A monster that
cannot be killed inside the fight's time limit (a boss's own clock, `COMBAT.maxFightSec`) is a certain loss.

Win chance: a closed form from the frozen profile and `monsterStats`. If `killSec > limit` the chance is 0. The same estimate weights new spawns ([`typeWeights`](monsters.md#typeweights)).
`limit` is min(180 s, the boss's own clock).

**Formula**

```text
killSec    = monster HP / (attacks/s x expectedHit)           expectedHit: crits and super crits weighted, monster armor applied
surviveSec = (HP + potions that fit between cooldowns) / (monster dps - regen - leech)
chance     = min(logistic(6 x ln(surviveSec / killSec)), logistic(6 x ln(limit / killSec)))
```

## Potions and skills

<a id="healamount"></a>

### `healAmount` <small>function</small>

Source: [`src/lib/skills.ts:19`](../../src/lib/skills.ts)

HP a Heal restores: its share of max HP, times the Intelligence bonus (the same one magic weapons get) and the gear's Spell Power.

**Formula**

```text
heal = 25% of max HP x (1 + magic damage% / 100) x (1 + Spell Power / 100)
```

<a id="autouse"></a>

### `autoUse` <small>function</small>

Source: [`src/lib/offline/fightSteps.ts:67`](../../src/lib/offline/fightSteps.ts)

Auto-use's rules for one tick: a potion below the HP line, Heal below its line, Stun whenever it is ready.

<a id="skills"></a>

### `SKILLS` <small>const</small>

Source: [`src/catalog/skills.ts:34`](../../src/catalog/skills.ts)

Potions and skills.

- Potions (`healHp` in the item catalog): Minor Healing 35 HP, Greater Healing 90 HP; they work in and out of fights, share an 8 s cooldown inside a fight (`COMBAT.potionCooldownSec`), cannot be drunk at full HP. Hotkeys 1-3 are requests the server checks.
- Skills, mana spent on cast, cooldown after: **Heal** (level 5, 20 mana, 12 s) restores `25% of max HP x (1 + magic damage% / 100) x (1 + Spell Power / 100)` in or out of a fight ([`healAmount`](combat.md#healamount));
  **Stun** (level 10, 15 mana, 30 s) freezes the monster's attack timer for 10 s, fights only; the monster's `stunResist` % can make it fail (mana and cooldown are still spent).
- **Auto-use** (switch, default on; a fixed preset in `COMBAT.auto`, [`autoUse`](combat.md#autouse)): a potion below 40% HP (best fit for the missing HP), Heal below 50%, Stun whenever it is ready.

Nothing else is learned or levelled. Four classes (warrior, paladin, ranger, mage) are cosmetic: a portrait and a name (`PLAYER_CLASSES`), no class gives a bonus.

**Skills** _(computed from the code)_

| Skill | Unlock level | Mana | Cooldown | Fights only | Effect |
| --- | --- | --- | --- | --- | --- |
| Heal | 5 | 20 | 12 s | no | 25% of max HP |
| Stun | 10 | 15 | 30 s | yes | 10 s stun |

## Results and rest

<a id="restthrough"></a>

### `restThrough` <small>function</small>

Source: [`src/lib/offline/fight.ts:164`](../../src/lib/offline/fight.ts)

After an absence the player is back on their feet: HP and mana refilled by resting for `gapSec`, no fight open, cooldowns over.

Results and rest. After a win the fight closes and the result stays in the event log until the browser acknowledges it; the window shows it `victoryToastSec` = 15 s.
A real absence (the gap since the server last saw the player is more than `UNCLAIMED_SEC` = 900 s, [`UNCLAIMED_SEC`](combat.md#unclaimed-sec)) rests the hero: HP and mana regenerated by the gap, cooldowns cleared, no fight open, queue cleared.
The ledger's `combat` record holds HP, mana, cooldowns, the open fight, switches, retry times and the numbered event log (`CombatState` in `src/lib/offline/fightTypes.ts`).
With a fight open the server runs it to its end on a copy ([`projectFight`](combat.md#projectfight)) and sends the plan: the browser draws HP and swings from it and asks again 0.4 s after the end (`COMBAT.poll.afterEndSec`), or whatever `nextPollSec` the server says. A fight it could not plan (`behind`) is polled every 0.5 s, then 2 s with the panel open, 8 s minimised or hidden (`COMBAT.poll`).

<a id="unclaimed-sec"></a>

### `UNCLAIMED_SEC` <small>const</small>

Source: [`src/lib/offline/grant.ts:46`](../../src/lib/offline/grant.ts)

The longest gap the server treats as the same session: past it an online call is refused with `claim_first`, and the hero rests (heals fully) through the gap. The client uses the same number, so the picture never jumps back.

## Consumables

<a id="buff-families"></a>

### `BUFF_FAMILIES` <small>const</small>

Source: [`src/catalog/buffs.ts:25`](../../src/catalog/buffs.ts)

The buff families. A saved buff names its family, so removing a family here makes saved buffs of it disappear on the next read (they are dropped,
never an error): see [`readBuffs`](combat.md#readbuffs).

<a id="max-active-buffs"></a>

### `MAX_ACTIVE_BUFFS` <small>const</small>

Source: [`src/lib/buffs.ts:18`](../../src/lib/buffs.ts)

How many different buffs can run at once. A sixth family is refused; drinking a family that already runs (a refresh) is always allowed.

<a id="readbuffs"></a>

### `readBuffs` <small>function</small>

Source: [`src/lib/buffs.ts:30`](../../src/lib/buffs.ts)

Cleans a stored buff list: anything that is not a well-formed buff of a known family is dropped, never an error, so a retired family or a damaged row
cannot reject the whole save. Also drops the buffs that have ended, keeps one per family (the one that lasts longest) and at most
[`MAX_ACTIVE_BUFFS`](combat.md#max-active-buffs). The stat is taken from the family, not from the stored row.

<a id="addbuff"></a>

### `addBuff` <small>function</small>

Source: [`src/lib/buffs.ts:63`](../../src/lib/buffs.ts)

Adds one buff effect to the running buffs.

- **Same family**: no stacking. The buff that lasts longer (more remaining time) wins as a whole, amount and end time; a tie keeps the larger amount.
  The potion is still used up when it loses.
- **Different family**: it stacks.
- **Cap**: with [`MAX_ACTIVE_BUFFS`](combat.md#max-active-buffs) different buffs running, a new family is refused with a message and nothing changes.

**Formula**

```text
until = nowSec + durationSec
same family:  keep the one with the larger `until` (tie: the larger amount)
new family:   refused when 5 other buffs are running
```

<a id="bufftotals"></a>

### `buffTotals` <small>function</small>

Source: [`src/lib/buffs.ts:84`](../../src/lib/buffs.ts)

The summed bonus per stat of the running buffs: additive percent, so two buffs on one stat add (families differ, the stat may not).
An empty list gives `{}`, so a fight with no potions reads no change.

**Formula**

```text
total[stat] = sum of amount over the running buffs that change `stat`
```

<a id="drink"></a>

### `drink` <small>function</small>

Source: [`src/lib/buffs.ts:125`](../../src/lib/buffs.ts)

Drinks one potion: every effect applies together or none does, so a refusal means nothing is consumed.

Refused when the potion has no effect, when a new buff does not fit ([`addBuff`](combat.md#addbuff)), and when it could do nothing: only heals, with HP (or mana)
already full for every one of them.

**Formula**

```text
hp' = min(maxHp, hp + healHp)      mp' = min(maxMp, mp + healMp)
buffs: each buff effect through addBuff; a refusal by any of them refuses the potion
```

<a id="withbuffs"></a>

### `withBuffs` <small>function</small>

Source: [`src/lib/offline/profile.ts:96`](../../src/lib/offline/profile.ts)

A profile with the running potion buffs on top ([`buffTotals`](combat.md#bufftotals)): each is an additive percent of the number it changes. No buffs gives the profile itself (the same object),
so a fight with no potions is exactly the fight there was before buffs. A fight freezes the result when it starts.

**Formula**

```text
hit' = hit x (1 + damagePct/100)         attacksPerSec' = attacksPerSec x (1 + atkSpeedPct/100)
armor' = armor x (1 + armorPct/100)       maxHp' = maxHp x (1 + maxHpPct/100)
crit' = min(maxCritChance, crit + critChance/100)       dodge' = min(maxDodge, dodge + dodge/100)
```

<a id="applyuse"></a>

### `applyUse` <small>function</small>

Source: [`src/lib/offline/consumables.ts:27`](../../src/lib/offline/consumables.ts)

Drinks the potion in bag slot `index`, at the server clock `nowSec` (the combat in `input` has already been brought up to now).

- Refused, with nothing consumed, when the slot holds no consumable with effects, when a fight is open and the potion cooldown still runs, when the
  potion would do nothing (full HP / mana) or when a sixth buff would be needed ([`drink`](combat.md#drink)).
- Otherwise one potion leaves the bag (the inventory `ver` grows), HP and mana are filled (capped by the max the running buffs give), a buff is
  recorded in `ledger.buffs` with its end time, a heal over time starts on the combat record, and in a fight the potion cooldown starts.
