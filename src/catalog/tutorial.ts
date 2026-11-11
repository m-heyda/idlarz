// The guided tutorial as data: Brother Alder's intro, the starter path and the milestone lessons. Order is data: a step is inserted between two others by
// putting it there in TUTORIAL_PATH (the new building system adds its 'build' step between the animal and the castle that way). Imports nothing from the
// config: the numbers in the texts arrive as `TutorialNumbers`, built from the live config in `lib/tutorial/numbers.ts`.

/** `strict`: everything outside the target is blocked; `soft`: dimmed only, the game stays usable. */
export type FocusMode = 'strict' | 'soft';

/** What the triggers look at: plain numbers and flags read from the game store and the events the guide counts (see `lib/tutorial/facts.ts`). */
export interface TutorialFacts {
	/** Trusted clicks on the map this chapter */
	clicks: number;
	/** Tiles bought this run (owned minus the free starter tiles) */
	tilesBought: number;
	/** Farm animals owned, all kinds together */
	animals: number;
	/** The first animal's food price is covered */
	animalAffordable: boolean;
	castleLevel: number;
	/** A castle upgrade is running */
	castleUpgrading: boolean;
	/** The castle upgrade's whole price is in the stores */
	castleAffordable: boolean;
	chestsOpened: number;
	chestOnMap: boolean;
	monsterOnMap: boolean;
	/** Fights that ended with the monster dead */
	fightsWon: number;
	merchantOpened: boolean;
	/** Attribute points the player has spent (a rebirth hands them back, the count follows) */
	pointsSpent: number;
	unspentPoints: number;
	/** Resource keys that were ever above zero in the stores or the rates (the header shows a chip for each, empty ones included) */
	seen: Readonly<Record<string, boolean>>;
	rebirths: number;
	/** Every rebirth requirement is met */
	rebirthReady: boolean;
	/** Windows that are open now */
	open: readonly string[];
}

/** The numbers the texts quote, read from the config (`buildNumbers`). */
export interface TutorialNumbers {
	clicksNeeded: number;
	tilePrice: string;
	animalName: string;
	animalFood: string;
	castleSeconds: string;
	castleGold: string;
	chestMinutes: number;
	offlineHours: number;
	offlinePct: number;
	rebirthCastle: number;
	rebirthTiles: number;
	autoRebirths: number;
}

/** A small gift the server grants once per account when the step is done. */
export interface TutorialReward {
	gold?: number;
	wood?: number;
	/** Food: the price of the first chicken */
	food?: number;
	/** Bag items by catalog id */
	items?: { id: string; qty: number }[];
}

interface BeatBase {
	id: string;
	/** Journal heading */
	title: string;
	focus: FocusMode;
	/** The `data-tutorial` id to spotlight; a function picks it from the facts (the Farm button, then the animal in the window) */
	target?: string | ((facts: TutorialFacts) => string | undefined);
	/** One or two sentences */
	text: (n: TutorialNumbers) => string;
}

/** A step of the starter path. The first step in the list that is ready and not done is the one on show. */
export interface PathStep extends BeatBase {
	/** The step can be done right now (a chest is on the map, the price is covered); a step that cannot wait for later ones */
	ready: (facts: TutorialFacts) => boolean;
	/** Done when this holds (also when the player got there on their own) */
	done: (facts: TutorialFacts) => boolean;
	reward?: TutorialReward;
}

/** A lesson that fires the first time `fires` holds, in any order, and is kept in the journal. */
export interface Lesson extends BeatBase {
	fires: (facts: TutorialFacts) => boolean;
}

export interface IntroPage {
	text: (n: TutorialNumbers) => string;
}

export const GUIDE_NAME = 'Brother Alder';
export const GUIDE_SPRITE = '/pixel/reuse/misc/sprite-fusion-374f7430-0e77-437e-8e6a-a0f4c6ac3332.png';
export const GUIDE_SPRITE_PX = 67;
/** Two frames side by side (closed mouth | open mouth), drawn from `GUIDE_SPRITE` by `scripts/guide-sprite.ts`; the bubble alternates them while the text is typed. */
export const GUIDE_TALK_SHEET = '/pixel/guide/alder_talk.png';

/** Shown dimmed, on the first start of a chapter. Recorded in the progress as `INTRO_ID`. */
export const INTRO_ID = 'intro';
export const INTRO: readonly IntroPage[] = [
	{ text: () => 'Welcome to Idle Realm. I am Brother Alder, and I will show you around.' },
	{ text: () => 'You rule a castle. Your land, your farm and your clicks all earn resources.' },
	{ text: () => 'Everything earns every second, even while you are away. Let us start with the first task.' },
];

/** The starter bundles, granted once per account by the server (IDL-67). */
export const STARTER_REWARDS = {
	tile: { gold: 100, wood: 20 },
	/** The price of the first chicken (`ANIMALS[0].baseCost`, pinned by tests/ui/tutorial.test.ts): Alder gives the player's first animal */
	farm: { food: 1000 },
	castle: { gold: 300 },
	potions: { items: [{ id: 'potion_minor', qty: 3 }] },
} as const satisfies Record<string, TutorialReward>;

const isOpen = (facts: TutorialFacts, id: string) => facts.open.includes(id);

/**
 * The guided tutorial (IDL-74): **Brother Alder**, a monk drawn on the left of the screen with a speech bubble. It is shown on localhost and on Vercel previews, and on the production site only after `GAME_EPOCH` is raised (the new chapter release); `NEXT_PUBLIC_GUIDE=on` forces it on anywhere ({@link guideVisibleFor}).
 *
 * - **Intro**: on the first start of a chapter the screen dims and Alder speaks three short bubbles. **Starter path**: nine steps in the order of {@link TUTORIAL_PATH}. The first step that is *ready* and not done is on show (the castle upgrade waits until it can be paid, the next ready step is shown meanwhile); a step the player did on their own is recorded without being shown. **Milestone lessons** (`TUTORIAL_LESSONS`) fire the first time something is reached, in any order, after the path; each is kept in the Guide's journal tab (locked ones read '???').
 * - **Focus**: `strict` dims and blurs the whole game with a cut-out around the `data-tutorial` target and blocks every click outside it (the intro and the first two steps); `soft` only dims. A target that is not on screen shows the bubble alone and never blocks the game. **Skip** is on every bubble and ends the starter path (lessons still come); the guide can be switched off in Settings.
 * - **Texts** are one or two sentences with numbers read from the config ({@link buildNumbers}). **Order is data**: a step is inserted between two others by putting it there (the new building system adds its 'build' step that way).
 * - **Progress is per account on the server** (`stats.tutorial` in the ledger: done ids, fired lessons, skipped; no migration) and resets with the ledger at a new chapter. **Starter bundles** are paid once per account by the server when a step is recorded, only if the last accepted save shows the step happened, and counted as `granted` ({@link applyTutorial}). The sim bot receives them at the same events.
 * - The long reference page (`Tutorial.tsx`) stays as the Guide's reference tab until every section has a journal entry.
 *
 * @title The guided tutorial
 * @category Progression/Guided tutorial
 * @order 0
 * @table tutorial-path
 * @table tutorial-lessons
 * @see applyTutorial, buildNumbers, guideVisibleFor
 */
export const TUTORIAL_PATH: readonly PathStep[] = [
	{
		id: 'click-gold',
		title: 'Click for gold',
		focus: 'strict',
		target: 'map',
		text: (n) => `Click anywhere on the map. Every click earns gold; try ${n.clicksNeeded} of them.`,
		ready: () => true,
		done: (f) => f.clicks >= 3,
	},
	{
		id: 'buy-tile',
		title: 'Buy a tile',
		focus: 'strict',
		target: 'tile-buy',
		text: (n) => `Gold buys land. Click a question mark beside your land to buy a tile for ${n.tilePrice} gold. Each tile earns income.`,
		ready: () => true,
		done: (f) => f.tilesBought >= 1,
		reward: STARTER_REWARDS.tile,
	},
	{
		id: 'farm-intro',
		title: 'Meet the farm',
		focus: 'soft',
		target: 'tab-farm',
		text: () => 'Your farm turns food into meat and goods: eggs, milk, hide and wool. Open the Farm window; your first animal is on me.',
		ready: () => true,
		done: (f) => isOpen(f, 'farm') || f.animals >= 1,
		reward: STARTER_REWARDS.farm,
	},
	{
		id: 'buy-animal',
		title: 'Buy an animal',
		focus: 'soft',
		target: (f) => (isOpen(f, 'farm') ? 'farm-animal' : 'tab-farm'),
		text: (n) => `Buy a ${n.animalName} for ${n.animalFood} food, a gift from me. It makes meat now and eggs soon; sheep grow wool, pigs hide, cows milk.`,
		ready: (f) => f.animalAffordable || f.animals > 0,
		done: (f) => f.animals >= 1,
	},
	{
		id: 'castle-upgrade',
		title: 'Upgrade the castle',
		focus: 'soft',
		target: (f) => (isOpen(f, 'castle') ? 'castle-upgrade' : 'castle'),
		text: (n) => `Click the castle and start its upgrade (${n.castleGold} gold and more). It takes ${n.castleSeconds} and boosts every resource.`,
		ready: (f) => f.castleAffordable || f.castleUpgrading || f.castleLevel >= 2,
		done: (f) => f.castleUpgrading || f.castleLevel >= 2,
		reward: STARTER_REWARDS.castle,
	},
	{
		id: 'open-chest',
		title: 'Open a chest',
		focus: 'soft',
		target: 'chest',
		text: (n) => `A chest has appeared on your land. Click it to see what is inside. A new one comes about every ${n.chestMinutes} minutes.`,
		ready: (f) => f.chestOnMap,
		done: (f) => f.chestsOpened >= 1,
	},
	{
		id: 'first-fight',
		title: 'Fight a monster',
		focus: 'soft',
		target: 'monster',
		text: () => 'A monster is on your land. Click it to fight. Wins pay gold, experience and sometimes gear.',
		ready: (f) => f.monsterOnMap,
		done: (f) => f.fightsWon >= 1,
	},
	{
		id: 'merchant',
		title: 'Meet the merchant',
		focus: 'soft',
		target: 'tab-merchant',
		text: () => 'The merchant buys your resources and sells gear and potions. Open the Merchant.',
		ready: () => true,
		done: (f) => f.merchantOpened,
	},
	{
		id: 'stat-point',
		title: 'Spend a stat point',
		focus: 'soft',
		target: (f) => (isOpen(f, 'character') ? 'stat-add' : 'tab-character'),
		text: () => 'Every level gives attribute points. Open the Character window and spend one.',
		ready: (f) => f.unspentPoints > 0 || f.pointsSpent > 0,
		done: (f) => f.pointsSpent >= 1,
		reward: STARTER_REWARDS.potions,
	},
];

const RESOURCE_LESSONS: readonly { key: string; title: string; text: string }[] = [
	{ key: 'wood', title: 'Wood', text: 'Wood comes from forests. Tiles and the castle upgrade cost it.' },
	{ key: 'stone', title: 'Stone', text: 'Stone comes from mountains and hills. Like wood, it goes into tiles and the castle.' },
	{ key: 'coal', title: 'Coal', text: 'Coal is dug from mines. The later castle levels need plenty of it.' },
	{ key: 'food', title: 'Food', text: 'Food feeds your farm: animals are bought with it. Fields and orchards grow it.' },
	{ key: 'hide', title: 'Hide', text: 'Hide drops from monsters and pigs. It is a crafting material and part of the price of bigger tiles.' },
	{ key: 'meat', title: 'Meat', text: 'Meat comes from farm animals. The later castle levels need it.' },
	{ key: 'eggs', title: 'Eggs', text: 'Chickens lay eggs. Sell them to the merchant for gold.' },
	{ key: 'milk', title: 'Milk', text: 'Cows give milk. Sell it to the merchant for gold.' },
	{ key: 'wool', title: 'Wool', text: 'Sheep grow wool. Sell it to the merchant for gold, or keep it: it becomes cloth armour later.' },
];

/** Milestone lessons: each fires the first time its condition holds, in any order, with a soft spotlight. */
export const TUTORIAL_LESSONS: readonly Lesson[] = [
	...RESOURCE_LESSONS.map(
		({ key, title, text }): Lesson => ({
			id: `res-${key}`,
			title,
			focus: 'soft',
			target: `res-${key}`,
			text: () => text,
			fires: (f) => !!f.seen[key],
		}),
	),
	{
		id: 'farm-upgrades',
		title: 'Farm upgrades',
		focus: 'soft',
		target: 'tab-farm',
		text: () =>
			'Each product has its own upgrade along the bottom of the Farm: Hen House for eggs, Dairy for milk, Tannery for hide, Shearing Shed for wool. Pasture boosts all four.',
		fires: (f) => f.animals >= 3,
	},
	{
		id: 'idols',
		title: 'Idols',
		focus: 'soft',
		text: () =>
			'Every biome has an Idol, a statue with a permanent bonus: +2% per level, up to level 5 as your castle grows. Right-click a tile and choose Build here. When you rebirth its level is kept: rebuild it free on any tile of that biome.',
		fires: (f) => f.castleLevel >= 3,
	},
	{
		id: 'income-offline',
		title: 'Income, timers and time away',
		focus: 'soft',
		target: 'top-resources',
		text: (n) =>
			`Your land earns every second; the Character window shows where the income comes from. Castle upgrades run on a timer, and while you are away the game pays ${n.offlinePct}% for up to ${n.offlineHours} hours.`,
		fires: (f) => f.tilesBought >= 3,
	},
	{
		id: 'gear-bag-potions',
		title: 'Gear, bag and potions',
		focus: 'soft',
		target: 'tab-equipment',
		text: (n) =>
			`Gear drops from fights and chests and goes into your bag; wear it in the Equipment window. Potions heal you in a fight. Auto-battle unlocks after ${n.autoRebirths === 1 ? 'your first rebirth' : `${n.autoRebirths} rebirths`}.`,
		fires: (f) => f.fightsWon >= 1,
	},
	{
		id: 'rebirth-embers',
		title: 'Rebirth and Embers',
		focus: 'soft',
		target: 'rebirth-button',
		text: (n) =>
			`You can rebirth now (castle ${n.rebirthCastle} and ${n.rebirthTiles} tiles). The map, gear and resources start over; level, gems and Embers stay. Embers give a permanent income bonus and buy upgrades, and a rebirth can open the next biome.`,
		fires: (f) => f.rebirthReady,
	},
	{
		id: 'auto-battle',
		title: 'Auto-battle',
		focus: 'soft',
		text: () => 'Auto-battle is unlocked. Switch it on in the combat panel and the game fights the monsters for you.',
		fires: (f) => f.rebirths >= 1,
	},
];

export const ALL_BEAT_IDS: readonly string[] = [INTRO_ID, ...TUTORIAL_PATH.map((s) => s.id), ...TUTORIAL_LESSONS.map((l) => l.id)];
