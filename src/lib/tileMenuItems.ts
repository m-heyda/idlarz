import type { BiomeType, MonsterType } from '@/types/game';
import { BIOMES } from '@/config/biomes';
import { MONSTERS } from '@/config/combatConfig';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import type { MapGameStore } from '@/components/game/mapSource';
import { buildingsEnabled } from '@/lib/buildings';
import { buildingMenuItems } from '@/lib/buildingMenu';

/** Id of the disabled Buildings entry shown while the building system is off (R7, IDL-91; the flag is `BUILDINGS_FLAG`, see {@link tileMenuItems}). */
export const BUILDINGS_ENTRY_ID = 'buildings';

export interface TileMenuContext {
	x: number;
	y: number;
	biome: BiomeType;
	game: MapGameStore;
	/** The monster on the tile; undefined: none */
	monster?: { id: number; type: MonsterType };
	/** This monster's place in the battle queue (0: not queued) and whether clicks now join the line */
	queuePos: number;
	lineOpen: boolean;
	hasChest: boolean;
}

/**
 * The entries of the right-click menu of an explored tile: what can be done here (dismiss a monster, open a chest, the disabled Buildings
 * placeholder, highlight the area). Reads the stores when called, so call it when the menu opens, not on render.
 */
export function tileMenuItems({ x, y, biome, game, monster, queuePos, lineOpen, hasChest }: TileMenuContext): ContextMenuItem[] {
	const ui = useUiStore.getState();
	const { startFight, collectChest } = game.getState();
	const own: ContextMenuItem[] = [];
	if (monster) {
		const { id, type } = monster;
		own.push(
			{
				id: 'fight',
				label: lineOpen ? (queuePos > 0 ? 'Remove from the queue' : `Add ${MONSTERS[type].label} to the queue`) : `Fight ${MONSTERS[type].label}`,
				onSelect: () => void startFight(id),
			},
			{ id: 'dismiss', label: `Dismiss ${MONSTERS[type].label}...`, danger: true, onSelect: () => ui.askDismissMonster(id) },
		);
	} else if (hasChest) {
		own.push({ id: 'chest', label: 'Open chest', onSelect: () => void collectChest(x, y) });
	}
	if (biome !== 'castle') {
		/**
		 * Placeholder for the per-biome building system (R7, IDL-91). The old 16 buildings were removed in IDL-259; this entry stays so the menu
		 * does not change shape when the new system lands. To wire it in: make it enabled, give it an `onSelect` that opens the new build UI
		 * for tile (x, y), and gate it on the new rules (biome, free tile, no monster or chest) the way the old "Build here..." entry did.
		 */
		// With the building system on (BUILDINGS_FLAG) the placeholder gives way to the real entries of this tile
		if (buildingsEnabled()) own.push(...buildingMenuItems(game, x, y));
		else own.push({ id: BUILDINGS_ENTRY_ID, label: 'Buildings: coming soon', disabled: true, onSelect: () => {} });
		own.push({
			id: 'highlight',
			label: `Highlight this ${BIOMES[biome]?.label ?? biome} area`,
			onSelect: () => ui.flashCluster(game.getState().tiles, x, y),
		});
	}
	return own;
}
