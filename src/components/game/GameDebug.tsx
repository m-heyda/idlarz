import { pickChestSpot } from '@/lib/chests';
import { castleLevelOf } from '@/lib/castleWard';
import React, { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, MAX_CATCHUP_SEC, XP_CAP } from '@/config/gameConfig';
import { MAX_OWNED_TILES, ownedCount, patchTile, tileAt } from '@/utils/world';
import { syntheticWorld } from '@/utils/worldGen';
import { growWorld } from '@/utils/growWorld';
import { ITEM_CATALOG, SETS, STARTER_BAG_ITEMS } from '@/catalog';
import { addToBag } from '@/lib/inventory';
import { maxHp } from '@/lib/combat';
import { pickSpawnTile } from '@/lib/monsters';
import { calculateResourceRates, calculateXpGain, countOwnedTiles, economyTiles } from '@/utils/gameUtils';
import type { MonsterType, Resources } from '@/types/game';
import PixelIcon from './PixelIcon';

type Tone = 'gold' | 'red' | 'blue' | 'gray' | '';
interface DebugAction {
	label: string;
	tone: Tone;
	run: () => void;
}

const addResources = (add: Partial<Resources>) => useGameStore.getState().addResources(add);
const toast = (text: string) => useUiStore.getState().showToast(text);

const spawnChest = () => {
	// the same placement rule as the timed spawn (frontier-leaning, spread out, never on the castle ward / buildings / monsters)
	const state = useGameStore.getState();
	const spot = pickChestSpot(state.tiles, new Set(state.monsters.map((m) => `${m.x},${m.y}`)), castleLevelOf(state.tiles));
	if (!spot) return toast('No eligible tile for a chest: buy more tiles first');
	useGameStore.setState((st) => ({
		tiles: patchTile(st.tiles, spot.x, spot.y, { hasChest: true }),
		activeChests: st.activeChests + 1,
	}));
	toast(`Chest spawned at tile (${spot.x}, ${spot.y})`);
};

const spawnMonster = (type: MonsterType) => {
	const state = useGameStore.getState();
	if (type === 'ratKing' && state.monsters.some((m) => m.type === 'ratKing')) return toast('There is already a Rat King on the map');
	const spot = pickSpawnTile(state.tiles, state.monsters, Math.random);
	if (!spot) return toast('No free explored tile for a monster: buy more tiles first');
	useGameStore.setState({
		monsters: [...state.monsters, { id: state.nextMonsterId, type, tier: 1, ...spot, ageSec: 0 }],
		nextMonsterId: state.nextMonsterId + 1,
	});
};

const giveSet = () => {
	useGameStore.setState((state) => {
		let bag = state.bag;
		const { pieces } = SETS.rattatui;
		const ring = pieces.find((id) => ITEM_CATALOG[id].slot === 'ring'); // a second ring for the other hand
		for (const id of ring ? [...pieces, ring] : pieces) bag = addToBag(bag, id, 1).bag;
		return { bag: addToBag(bag, STARTER_BAG_ITEMS[0].id, 5).bag };
	});
};

const heal = () => useGameStore.setState((state) => ({ playerHp: maxHp(state.characterStats, state.equipment) }));

// Dev shortcuts for testing the late game quickly
const castleUp = () =>
	useGameStore.setState((state) => {
		const castle = tileAt(state.tiles, CASTLE_X, CASTLE_Y);
		const level = Math.min((castle.level ?? 1) + 1, CASTLE_UPGRADE.maxLevel);
		const tiles = patchTile(state.tiles, CASTLE_X, CASTLE_Y, {
			level,
			upgradeCost: level < CASTLE_UPGRADE.maxLevel ? { ...CASTLE_UPGRADE.upgradeCosts[level - 1] } : undefined,
		});
		return { tiles, castleUpgrade: null };
	});

/** Grows the map by `count` connected tiles at once (a seeded random blob, reaching negative coordinates). Cheat: the XP those tiles would have paid is granted, so the game stays saveable. */
const growMap = (count: number) => {
	const s = useGameStore.getState();
	const n = Math.min(count, MAX_OWNED_TILES - ownedCount(s.tiles));
	if (n <= 0) return toast('The map is full');
	const t0 = performance.now();
	const tiles = syntheticWorld(n, ownedCount(s.tiles), s.tiles);
	let needed = 0;
	for (let k = 2; k <= economyTiles(tiles, s.freeTiles); k++) needed += calculateXpGain(k);
	const xp = Math.max(s.resources.xp, Math.min(needed * 1.01, XP_CAP));
	const resourceRates = calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	useGameStore.setState({ tiles, resources: { ...s.resources, xp }, resourceRates });
	toast(`Added ${n.toLocaleString('en')} tiles in ${Math.round(performance.now() - t0)} ms (${ownedCount(tiles).toLocaleString('en')} in all)`);
};

let labSeed = 0;
/** Map lab: replaces the map with a fresh seeded one rolled exactly like real purchases (rollBiome), to eyeball how the land and its art come out. Cheat: grants the XP those tiles would have cost. */
const rolledMap = (purchases: number, policy: 'nearest' | 'random') => {
	const s = useGameStore.getState();
	const seed = labSeed++;
	const tiles = growWorld(purchases, seed, policy);
	let needed = 0;
	for (let k = 2; k <= economyTiles(tiles, s.freeTiles); k++) needed += calculateXpGain(k);
	const xp = Math.max(s.resources.xp, Math.min(needed * 1.01, XP_CAP));
	const resourceRates = calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	useGameStore.setState({ tiles, resources: { ...s.resources, xp }, resourceRates, monsters: [], activeChests: 0 });
	toast(`Rolled map: seed ${seed}, ${purchases} purchases (${policy})`);
};

const fastForward = () => {
	for (let i = 0; i < 12; i++) useGameStore.getState().tick(MAX_CATCHUP_SEC * 1000);
};

const GROUPS: { title: string; actions: DebugAction[] }[] = [
	{
		title: 'Resources',
		actions: [
			{ label: '+100k Gold', tone: 'gold', run: () => addResources({ gold: 100000 }) },
			{ label: '+100k Wood', tone: '', run: () => addResources({ wood: 100000 }) },
			{ label: '+100k Stone', tone: 'gray', run: () => addResources({ stone: 100000 }) },
			{ label: '+100k Coal', tone: 'gray', run: () => addResources({ coal: 100000 }) },
			{ label: '+100k Food', tone: 'gold', run: () => addResources({ food: 100000 }) },
			{ label: '+100k Meat', tone: 'red', run: () => addResources({ meat: 100000 }) },
			{ label: '+1.5k XP', tone: 'blue', run: () => addResources({ xp: 1500 }) },
		],
	},
	{
		title: 'Spawn',
		actions: [
			{ label: 'Chest', tone: 'blue', run: spawnChest },
			{ label: 'Rat', tone: 'red', run: () => spawnMonster('rat') },
			{ label: 'Rat King', tone: 'red', run: () => spawnMonster('ratKing') },
			{ label: 'Rattatui set', tone: '', run: giveSet },
		],
	},
	{
		title: 'Player',
		actions: [
			{ label: 'Heal', tone: '', run: heal },
			{ label: 'Castle +1 level', tone: 'blue', run: castleUp },
			{ label: 'Reset name', tone: 'gray', run: () => useGameStore.getState().setPlayerName('Explorer') },
		],
	},
	{
		title: 'Map',
		actions: [
			{ label: '+500 tiles', tone: 'gray', run: () => growMap(500) },
			{ label: '+5k tiles', tone: 'gray', run: () => growMap(5000) },
			{ label: '+50k tiles', tone: 'red', run: () => growMap(50000) },
			{ label: 'Rolled map 60', tone: 'blue', run: () => rolledMap(60, 'nearest') },
			{ label: 'Rolled map 400', tone: 'blue', run: () => rolledMap(400, 'nearest') },
			{ label: 'Rolled map 400 ragged', tone: 'blue', run: () => rolledMap(400, 'random') },
		],
	},
	{
		title: 'Time',
		actions: [{ label: '+1 hour', tone: 'gray', run: fastForward }],
	},
];

const GameDebug: React.FC = () => {
	const showAdmin = useUiStore((state) => state.showAdmin);
	const collapsed = useUiStore((state) => state.adminCollapsed);
	const setPref = useUiStore((state) => state.setPref);
	const playerName = useGameStore((state) => state.playerName);
	const ownedTiles = useGameStore((state) => countOwnedTiles(state.tiles));

	// Dev only: expose the store on window for manual testing in the console (never in production builds)
	useEffect(() => {
		if (process.env.NODE_ENV === 'development') {
			(window as unknown as { __game?: typeof useGameStore }).__game = useGameStore;
		}
	}, []);

	if (process.env.NODE_ENV !== 'development' || !showAdmin) return null;

	if (collapsed) {
		return (
			<div className='fixed bottom-4 left-16 z-40'>
				<div className='pixel-slot' title='Admin tools (dev)' role='button' onClick={() => setPref('adminCollapsed', false)}>
					<PixelIcon name='menu_settings' alt='Admin tools' scale={0.8} />
				</div>
			</div>
		);
	}

	return (
		<div className='fixed bottom-4 left-16 z-40 px-panel text-xs max-w-[min(420px,calc(100vw-96px))]' aria-label='Admin tools'>
			<div className='flex items-start justify-between gap-3 mb-2'>
				<div>
					<div className='px-h'>Admin (dev)</div>
					<div className='text-[#a89878]'>
						{playerName} - {ownedTiles} tiles
					</div>
				</div>
				<button className='px-btn px-btn-sm' title='Collapse to an icon' onClick={() => setPref('adminCollapsed', true)}>
					Hide
				</button>
			</div>
			{GROUPS.map((group) => (
				<div key={group.title} className='mb-2 last:mb-0'>
					<div className='text-[#a89878] mb-1'>{group.title}</div>
					<div className='flex flex-wrap gap-1'>
						{group.actions.map((action) => (
							<button
								key={action.label}
								className={`px-btn px-btn-sm${action.tone ? ` px-btn-${action.tone}` : ''}`}
								onClick={action.run}>
								{action.label}
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	);
};

export default GameDebug;
