import { pickChestSpot } from '@/lib/chests';
import { castleLevelOf } from '@/lib/castleWard';
import React, { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { CASTLE_UPGRADE, GRID_CENTER_X, GRID_CENTER_Y, MAX_CATCHUP_SEC } from '@/config/gameConfig';
import { ITEM_CATALOG, SETS, STARTER_BAG_ITEMS } from '@/catalog';
import { addToBag } from '@/lib/inventory';
import { maxHp } from '@/lib/combat';
import { pickSpawnTile } from '@/lib/monsters';
import type { MonsterType } from '@/types/game';

const GameDebug: React.FC = () => {
	const { playerName, setPlayerName, tiles, addResources, resources } =
		useGameStore();

	// Count owned tiles for debugging
	const countOwnedTiles = () => {
		let count = 0;
		tiles.forEach((row) => {
			row.forEach((tile) => {
				if (tile && tile.isOwned) {
					count++;
				}
			});
		});
		return count;
	};

	const ownedTileCount = countOwnedTiles();

	const handleSimulateFirstTile = () => {
		// Set name back to Explorer to trigger the dialog
		setPlayerName('Explorer');
		// We would need access to buyTile, but this is just for debugging
		alert('Name reset to Explorer. Buy a tile to trigger the name prompt.');
	};

	const handleAddGold = () => {
		addResources({ gold: 100000 });
	};

	const handleAddWood = () => {
		addResources({ wood: 100000 });
	};

	const handleAddStone = () => {
		addResources({ stone: 100000 });
	};

	const handleAddCoal = () => {
		addResources({ coal: 100000 });
	};

	const handleAddFood = () => {
		addResources({ food: 100000 });
	};

	const handleAddMeat = () => {
		addResources({ meat: 100000 });
	};
	
	const handleAddXp = () => {
		addResources({ xp: 1500 });
	};

	const handleSpawnChest = () => {
		// the same placement rule as the timed spawn (frontier-leaning, spread out, never on the castle ward / buildings / monsters)
		const state = useGameStore.getState();
		const spot = pickChestSpot(state.tiles, new Set(state.monsters.map((m) => `${m.x},${m.y}`)), castleLevelOf(state.tiles));
		if (!spot) {
			alert('No eligible tiles for chest spawning. Buy more tiles first!');
			return;
		}
		useGameStore.setState((st) => {
			const newTiles = [...st.tiles];
			newTiles[spot.y] = [...newTiles[spot.y]];
			newTiles[spot.y][spot.x] = { ...newTiles[spot.y][spot.x], hasChest: true };
			return { tiles: newTiles, activeChests: st.activeChests + 1 };
		});
		alert(`Chest spawned at tile (${spot.x}, ${spot.y})`);
	};

	const handleSpawnMonster = (type: MonsterType) => {
		const state = useGameStore.getState();
		if (type === 'ratKing' && state.monsters.some((m) => m.type === 'ratKing')) {
			alert('There is already a Rat King on the map.');
			return;
		}
		const spot = pickSpawnTile(state.tiles, state.monsters, Math.random);
		if (!spot) {
			alert('No free owned tile for a monster. Buy more tiles first!');
			return;
		}
		useGameStore.setState({
			monsters: [...state.monsters, { id: state.nextMonsterId, type, tier: 1, ...spot, ageSec: 0 }],
			nextMonsterId: state.nextMonsterId + 1,
		});
	};

	const handleGiveSet = () => {
		useGameStore.setState((state) => {
			let bag = state.bag;
			const { pieces } = SETS.rattatui;
			const ring = pieces.find((id) => ITEM_CATALOG[id].slot === 'ring'); // a second ring for the other hand
			for (const id of ring ? [...pieces, ring] : pieces) bag = addToBag(bag, id, 1).bag;
			return { bag: addToBag(bag, STARTER_BAG_ITEMS[0].id, 5).bag };
		});
	};

	const handleHeal = () => {
		useGameStore.setState((state) => ({ playerHp: maxHp(state.characterStats, state.equipment) }));
	};

	// Dev only: expose the store on window for manual testing in the console (never in production builds)
	useEffect(() => {
		if (process.env.NODE_ENV === 'development') {
			(window as unknown as { __game?: typeof useGameStore }).__game = useGameStore;
		}
	}, []);

	// Dev shortcuts for testing the late game quickly
	const handleCastleUp = () => {
		useGameStore.setState((state) => {
			const tiles = state.tiles.map((row) => [...row]);
			const castle = tiles[GRID_CENTER_Y][GRID_CENTER_X];
			const level = Math.min((castle.level ?? 1) + 1, CASTLE_UPGRADE.maxLevel);
			tiles[GRID_CENTER_Y][GRID_CENTER_X] = {
				...castle,
				level,
				upgradeCost: level < CASTLE_UPGRADE.maxLevel ? { ...CASTLE_UPGRADE.upgradeCosts[level - 1] } : undefined,
			};
			return { tiles, castleUpgrade: null };
		});
	};

	const handleFastForward = () => {
		for (let i = 0; i < 12; i++) useGameStore.getState().tick(MAX_CATCHUP_SEC * 1000);
	};

	if (process.env.NODE_ENV !== 'development') return null;

	return (
		<div className='fixed bottom-4 left-4 z-50 bg-gray-800 p-4 rounded-md text-white text-xs'>
			<div className='mb-2'>
				<strong>Debug Info:</strong>
				<div>Player Name: {playerName}</div>
				<div>Owned Tiles: {ownedTileCount}</div>
				<div>Gold: {resources.gold.toFixed(0)}</div>
			</div>
			<div className='flex gap-2 flex-wrap'>
				<button
					onClick={handleSimulateFirstTile}
					className='bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-xs'>
					Reset Name
				</button>
				<button
					onClick={handleAddGold}
					className='bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 100k Gold
				</button>
				<button
					onClick={handleAddWood}
					className='bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 100k Wood
				</button>
				<button
					onClick={handleAddStone}
					className='bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 100k Stone
				</button>
				<button
					onClick={handleAddCoal}
					className='bg-black hover:bg-gray-900 text-white px-2 py-1 rounded-md text-xs border border-gray-700'>
					Add 100k Coal
				</button>
				<button
					onClick={handleAddFood}
					className='bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 100k Food
				</button>
				<button
					onClick={handleAddMeat}
					className='bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 100k Meat
				</button>
				<button
					onClick={handleAddXp}
					className='bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md text-xs'>
					Add 1.5k XP
				</button>
				<button
					onClick={handleSpawnChest}
					className='bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-md text-xs'>
					Spawn Chest
				</button>
				<button
					onClick={() => handleSpawnMonster('rat')}
					className='bg-red-700 hover:bg-red-800 text-white px-2 py-1 rounded-md text-xs'>
					Spawn Rat
				</button>
				<button
					onClick={() => handleSpawnMonster('ratKing')}
					className='bg-amber-700 hover:bg-amber-800 text-white px-2 py-1 rounded-md text-xs'>
					Spawn Rat King
				</button>
				<button
					onClick={handleGiveSet}
					className='bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1 rounded-md text-xs'>
					Give Rattatui set
				</button>
				<button
					onClick={handleHeal}
					className='bg-green-700 hover:bg-green-800 text-white px-2 py-1 rounded-md text-xs'>
					Heal
				</button>
				<button
					onClick={handleCastleUp}
					className='bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md text-xs'>
					Castle +1 level
				</button>
				<button
					onClick={handleFastForward}
					className='bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded-md text-xs'>
					+1 hour
				</button>
			</div>
		</div>
	);
};

export default GameDebug;
