import { buildingDef } from '@/catalog/buildings';
import { idolDef, type IdolDef } from '@/catalog/idols';
import { GENERAL_RULES, IDOL_RULES } from '@/config/buildings';
import { LEVELING } from '@/config/character';
import { HARD_LIMITS } from '@/config/limits';
import { PARAGON_IDS, type ParagonId } from '@/config/paragon';
import { paragonBonuses } from '@/lib/offline/paragon';
import { forEachOwned, type World } from '@/utils/world';

/**
 * What the standing Idols add to the economy: one pure function of the map and the remembered levels, used by the browser and by the server (`summarize` in cloudSave/summary.ts), the way {@link gearEconomy} works for gear.
 * Percentages are whole numbers (6 = +6 %); `luck` is in points; `offlineEffPts` is percentage points of the share of the income paid while away.
 */
export interface IdolEconomy {
	/** % more XP from every source (Elder Tree Statue) */
	xpPct: number;
	/** % more gold and XP from a kill (Totem of the Wild) */
	killRewardPct: number;
	/** Percentage points added to the share of the income paid while away (Frost Obelisk) */
	offlineEffPts: number;
	/** Luck points (Bog Witch Totem) */
	luck: number;
	/** % faster chests (Water Spirit Fountain) */
	chestSpeedPct: number;
	/** % more crafting XP (Blossom Shrine) */
	craftXpPct: number;
	/** % more damage (Maw Idol) */
	damagePct: number;
	/** % more max HP and armor (War Memorial) */
	hpArmorPct: number;
	/** % shorter castle and building timers (Dwarf Statue), before the cap shared with Master Builders */
	buildTimePct: number;
	/** % more of every farm product: meat, eggs, milk, hide (Harvest Scarecrow) */
	farmOutputPct: number;
	/** % more gold per map click (Scarecrow King) */
	clickGoldPct: number;
	/** % more gold from everything sold to the merchant (Lighthouse) */
	merchantSellPct: number;
	/** The Paragon upgrades that have no Idol counterpart (docs/plan/paragon.md); the Paragon points that do (XP, kill rewards, damage, Luck, away income, crafting XP, click gold, build time) are added to the fields above. */
	/** % more max HP (Paragon: Maximum life), life only, not armor */
	maxHpPct: number;
	/** % more damage from a critical hit (Paragon) */
	critDamagePct: number;
	/** % of the damage dealt healed (Paragon: Life leech) */
	lifeLeechPct: number;
	/** Seconds added to a boss fight's clock (Paragon) */
	bossTimerSec: number;
	/** % more of every resource but XP (Paragon: Income, its own multiplicative bucket) */
	incomePct: number;
	/** % off the gold price of tiles (Paragon) */
	tileDiscountPct: number;
	/** % more gold from drops and sales (Paragon: Gold find) */
	goldFindPct: number;
	/** Percentage points more chance that a new monster is golden (Paragon) */
	goldenChancePts: number;
	/** Percentage points more chance that a monster drops a chest (Paragon) */
	chestDropPts: number;
	/** % more chance of epic and better items (Paragon, relative) */
	epicFindPct: number;
	/** % more healing and buff power from potions (Paragon) */
	potionPowerPct: number;
	/** % more XP past level 100 (Paragon) */
	paragonXpPct: number;
}

export const NO_IDOL_ECONOMY: IdolEconomy = {
	xpPct: 0,
	killRewardPct: 0,
	offlineEffPts: 0,
	luck: 0,
	chestSpeedPct: 0,
	craftXpPct: 0,
	damagePct: 0,
	hpArmorPct: 0,
	buildTimePct: 0,
	farmOutputPct: 0,
	clickGoldPct: 0,
	merchantSellPct: 0,
	maxHpPct: 0,
	critDamagePct: 0,
	lifeLeechPct: 0,
	bossTimerSec: 0,
	incomePct: 0,
	tileDiscountPct: 0,
	goldFindPct: 0,
	goldenChancePts: 0,
	chestDropPts: 0,
	epicFindPct: 0,
	potionPowerPct: 0,
	paragonXpPct: 0,
};

/** The Idols standing on a map: biome -> the level on its tile (1 when the field is absent). Cached per World, so the per-tick callers do not scan the map. */
const standingCache = new WeakMap<World, Record<string, number>>();
export const standingIdols = (tiles: World): Record<string, number> => {
	let out = standingCache.get(tiles);
	if (!out) {
		out = {};
		forEachOwned(tiles, (tile) => {
			const def = idolDef(tile.building);
			if (def) out![def.biome] = Math.max(1, Math.min(HARD_LIMITS.idolMaxLevel, Math.floor(tile.buildingLevel ?? 1)));
		});
		standingCache.set(tiles, out);
	}
	return out;
};

/** The level an Idol works at: the level of its tile, never above the level the account remembers for the biome (`idolLevels`, the server-trusted record: a biome it does not list works at level 0; `undefined` = no limit, as before the record existed). */
export const effectiveIdolLevel = (tileLevel: number, remembered: number | undefined): number =>
	Math.max(0, remembered === undefined ? tileLevel : Math.min(tileLevel, remembered));

/**
 * The economy effects of the standing Idols. Each level adds `perLevel` (2 %) of its effect, the Bog Witch Totem `luckPerLevel` (4) Luck points. Only the effects the game applies are counted (`IdolDef.applied`).
 *
 * @category Economy/Buildings
 * @order 8
 * @formula
 * effect = IDOL_RULES.perLevel x level  (percent)          Luck: luckPerLevel x level points
 * level = min(level on the tile, level the account remembers for the biome)
 */
export const idolEconomy = (tiles: World, idolLevels?: Record<string, number>, paragon?: Partial<Record<ParagonId, number>>): IdolEconomy => {
	const standing = standingIdols(tiles);
	const out = { ...NO_IDOL_ECONOMY };
	for (const [biome, tileLevel] of Object.entries(standing)) {
		// with a record, an Idol it does not list works at level 0 (never learned or not accepted by the server); with none (an old save, a test) the tile's level counts
		const level = effectiveIdolLevel(tileLevel, idolLevels ? (idolLevels[biome] ?? 0) : undefined);
		if (level <= 0) continue;
		const pct = level * IDOL_RULES.perLevel;
		switch (biome) {
			case 'forest':
				out.xpPct += pct;
				break;
			case 'hills':
				out.buildTimePct += pct;
				break;
			case 'swamp':
				out.luck += level * IDOL_RULES.luckPerLevel;
				break;
			case 'tundra':
				out.offlineEffPts += pct;
				break;
			case 'lake':
				out.chestSpeedPct += pct;
				break;
			case 'jungle':
				out.killRewardPct += pct;
				break;
			case 'orchard':
				out.craftXpPct += pct;
				break;
			case 'blight':
				out.damagePct += pct;
				break;
			case 'battlefield':
				out.hpArmorPct += pct;
				break;
			case 'plains':
				out.farmOutputPct += pct;
				break;
			case 'fields':
				out.clickGoldPct += pct;
				break;
			case 'coast':
				out.merchantSellPct += pct;
				break;
		}
	}
	// the general buildings: every level of every copy adds a little of its effect
	forEachOwned(tiles, (tile) => {
		const def = buildingDef(tile.building);
		if (def?.kind !== 'general') return;
		const pct = Math.max(1, Math.min(HARD_LIMITS.buildingMaxLevel, Math.floor(tile.buildingLevel ?? 1))) * GENERAL_RULES.perLevel;
		switch (def.effect) {
			case 'damage':
				out.damagePct += pct;
				break;
			case 'merchantSell':
				out.merchantSellPct += pct;
				break;
			case 'xpGain':
				out.xpPct += pct;
				break;
			case 'craftXp':
				out.craftXpPct += pct;
				break;
			case 'killRewards':
				out.killRewardPct += pct;
				break;
			case 'hpArmor':
				out.hpArmorPct += pct;
				break;
		}
	});
	if (paragon) addParagon(out, paragon);
	return out;
};

/** Which number of the {@link IdolEconomy} each Paragon upgrade adds to (the one place the upgrades are folded in; `scripts/stat-audit.ts` pins it at 0, 1, the cap and over it) */
export const PARAGON_IDOL_FIELD: Record<ParagonId, keyof IdolEconomy> = {
	damage: 'damagePct',
	maxLife: 'maxHpPct',
	critDamage: 'critDamagePct',
	lifeLeech: 'lifeLeechPct',
	bossTimer: 'bossTimerSec',
	income: 'incomePct',
	xpGain: 'xpPct',
	tileDiscount: 'tileDiscountPct',
	clickGold: 'clickGoldPct',
	killRewards: 'killRewardPct',
	luck: 'luck',
	goldFind: 'goldFindPct',
	goldenChance: 'goldenChancePts',
	chestDrop: 'chestDropPts',
	epicFind: 'epicFindPct',
	offlineEff: 'offlineEffPts',
	buildSpeed: 'buildTimePct',
	potionPower: 'potionPowerPct',
	paragonXp: 'paragonXpPct',
	craftXp: 'craftXpPct',
};

/**
 * The Paragon points spent (the ledger's record, docs/plan/paragon.md) added to the same numbers the Idols fill, so every place that already applies an Idol's bonus applies the paragon's too, in the browser and on the server (`summarize`). Each
 * upgrade is worth `paragonBonuses` in its own unit; the ones with an Idol counterpart add to that field, the others fill their own.
 */
const addParagon = (out: IdolEconomy, spent: Partial<Record<ParagonId, number>>): void => {
	const b = paragonBonuses(spent);
	for (const id of PARAGON_IDS) out[PARAGON_IDOL_FIELD[id]] += b[id];
};

/** The multiplier on max HP the Idols (War Memorial) and the Paragon Maximum life upgrade give. */
export const hpMultOf = (idol: IdolEconomy): number => (1 + idol.hpArmorPct / 100) * (1 + idol.maxHpPct / 100);

/** The XP % the economy applies: the Idols' (and the Paragon XP gain upgrade's) plus, from level 100 on, the Paragon XP upgrade (which counts only past level 100). */
export const xpPctAt = (idol: IdolEconomy, level: number): number => idol.xpPct + (level >= LEVELING.maxLevel ? idol.paragonXpPct : 0);

/** True when no Idol effect is on (so a caller can leave its numbers untouched). */
export const noIdolEffect = (e: IdolEconomy): boolean => Object.values(e).every((v) => v === 0);

/** The value of an Idol at `level` as the UI states it: "+6 %" (Luck: "+12"), and the text after it. */
export const idolValueText = (def: IdolDef, level: number): string => {
	if (level <= 0) return '+0';
	return def.effect === 'luck' ? `+${level * IDOL_RULES.luckPerLevel} ${def.effectText}` : `+${level * IDOL_RULES.perLevel} % ${def.effectText}`;
};
