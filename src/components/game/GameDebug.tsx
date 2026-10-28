import { castleLevelOf } from '@/lib/castleWard';
import React, { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { XP_CAP } from '@/config/gameConfig';
import { MAX_OWNED_TILES, ownedCount } from '@/utils/world';
import { syntheticWorld } from '@/utils/worldGen';
import { growWorld } from '@/utils/growWorld';
import { ITEM_CATALOG } from '@/catalog';
import { resolveItem } from '@/lib/itemInstance';
import { generateLoot, receiveDrops } from '@/lib/loot';
import { maxHp } from '@/lib/combat';
import { calculateResourceRates, calculateXpGain, countOwnedTiles, economyTiles } from '@/utils/gameUtils';
import type { Resources } from '@/types/game';
import PixelIcon from './PixelIcon';

type Tone = 'gold' | 'red' | 'blue' | 'gray' | '';
interface DebugAction {
	label: string;
	tone: Tone;
	run: () => void;
}

const addResources = (add: Partial<Resources>) => useGameStore.getState().addResources(add);
const toast = (text: string) => useUiStore.getState().showToast(text);

/** Rolls the loot of a source through the real pipeline at the current castle level, puts it in the bag and logs why it dropped (console.table). */
const rollLoot = (sourceId: 'rat' | 'ratKing' | 'chest', level?: number) => {
	const state = useGameStore.getState();
	const castleLevel = castleLevelOf(state.tiles);
	const owned = [
		...Object.values(state.equipment).map((item) => item?.base),
		...state.bag.map((slot) => (slot && 'item' in slot ? slot.item.base : slot?.id)),
	].filter((id): id is string => !!id);
	const result = generateLoot({ sourceId, level, castleLevel, owned, pity: state.lootPity }, Math.random);
	const received = receiveDrops(state.bag, result.drops, state.autoSellUpTo, state);
	useGameStore.setState({ bag: received.bag, lootPity: result.pity, resources: { ...state.resources, gold: state.resources.gold + received.autoSold.gold + received.convertedGold } });
	console.table(result.trace);
	const names = result.drops.map((d) => (d.kind === 'gear' ? `${resolveItem(d.item)?.name} (${d.item.rarity}, il ${d.item.level})` : `${d.qty}x ${ITEM_CATALOG[d.id].name}`));
	toast(`${sourceId} (level ${result.sourceLevel}): ${names.join(', ') || 'nothing'}`);
};

const heal = () => useGameStore.setState((state) => ({ playerHp: maxHp(state.characterStats, state.equipment) }));

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
	const resourceRates = calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades);
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
	const resourceRates = calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades);
	useGameStore.setState({ tiles, resources: { ...s.resources, xp }, resourceRates, monsters: [], activeChests: 0 });
	toast(`Rolled map: seed ${seed}, ${purchases} purchases (${policy})`);
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
		],
	},
	{
		title: 'Loot',
		actions: [{ label: 'Loot: chest', tone: 'gray', run: () => rollLoot('chest') }],
	},
	{
		title: 'Player',
		actions: [{ label: 'Heal', tone: '', run: heal }],
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
