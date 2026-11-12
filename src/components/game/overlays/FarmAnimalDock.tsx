import React from 'react';
import { Button, HoverTip } from '../../../../packages/design-system/src/components/primitives';
import { HintTooltip, TipCostList, Tooltip } from '../../../../packages/design-system/src/components/tooltips';
import { compact } from '../../../../packages/design-system/src/logic';
import { RESOURCES } from '@/catalog';
import { ANIMALS, FARM_UPGRADES } from '@/config/farm';
import { PIXEL_ICON_SIZES, animalIcon } from '@/config/pixelIcons';
import { useGameStore } from '@/stores/gameStore';
import audioManager from '@/utils/audioManager';
import { formatNumber } from '@/utils/formatters';
import { animalOutput, calculateAnimalCost, farmCap, farmUpgradeLevel } from '@/utils/game/farm';
import type { Animal } from '@/types/game';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';
import { resourceIconUrl } from '../hero/recipeUi';

/** Width the scene keeps clear on the right while the panel is open (panel width plus its margin) */
export const ANIMAL_DOCK_WIDTH = 272;

interface FarmAnimalDockProps {
	open: boolean;
	onToggle: () => void;
	/** buy that many animals of a kind */
	onBuy: (animalId: string, count: number) => void;
	/** The kind under the cursor, so the scene can light up its animals */
	onHover: (animalId: string | null) => void;
}

interface AnimalRowProps {
	animal: Animal;
	owned: number;
	upgrades: Record<string, number>;
	food: number;
	onBuy: (count: number) => void;
	onHover: (hovering: boolean) => void;
}

/** One animal in the panel: what it yields, how many you have out of the pen limit, and a Buy button (the price is in its hover card). */
const AnimalRow: React.FC<AnimalRowProps> = ({ animal, owned, upgrades, food, onBuy, onHover }) => {
	const cap = farmCap(upgrades);
	const full = owned >= cap;
	const one = animalOutput(animal, 1, upgrades);
	const product = animal.product.resource;
	const cost = calculateAnimalCost(animal, owned);
	const penMaxed = farmUpgradeLevel(upgrades, 'pen') >= FARM_UPGRADES.pen.maxLevel;
	const canBuy = !full && food >= cost;
	const reason = full ? (penMaxed ? 'The pen is as big as it gets.' : 'Pen full: expand it below.') : 'Not enough food.';

	return (
		<div
			className='farm-animal-card'
			data-tutorial={animal.id === ANIMALS[0].id ? 'farm-animal' : undefined}
			data-ok={canBuy}
			role='group'
			aria-label={animal.name}
			onMouseEnter={() => onHover(true)}
			onMouseLeave={() => onHover(false)}
		>
			<div className='farm-animal-head'>
				<PixelIcon name={animalIcon(animal.id)} scale={30 / PIXEL_ICON_SIZES[animalIcon(animal.id)][0]} alt='' />
				<span className='farm-animal-name'>{animal.name}</span>
				<span className='farm-animal-count' title='Animals owned / pen limit'>
					{owned}/{cap}
				</span>
			</div>
			<div className='farm-animal-yield'>
				<span className='inline-flex items-center gap-1' style={{ color: '#ff8d7c' }}>
					{formatNumber(one.meat)}/s <ResourceIcon resource='meat' />
				</span>
				<span className='inline-flex items-center gap-1' style={{ color: '#f0d27a' }}>
					{formatNumber(one[product])}/s <ResourceIcon resource={product} />
				</span>
				<span className='farm-animal-each'>each</span>
			</div>
			<HoverTip
				fill
				placement='below'
				align='center'
				tip={
					<Tooltip icon={resourceIconUrl('food')} title={`Buy ${animal.name}`} className='ds-tip-compact'>
						<TipCostList costs={[{ label: RESOURCES.food.label, icon: resourceIconUrl('food'), have: food, cost, text: compact(cost) }]} />
						{canBuy ? null : <HintTooltip title='' text={reason} tone='bad' />}
					</Tooltip>
				}
			>
				<Button
					tone={canBuy ? 'gold' : 'dark'}
					size='sm'
					style={{ width: '100%' }}
					disabled={!canBuy}
					onClick={() => {
						onBuy(1);
						audioManager.playSound('click');
					}}
				>
					Buy · {compact(cost)} food
				</Button>
			</HoverTip>
		</div>
	);
};

/** The animal shop along the right edge of the farm scene (the upgrade drawer slides up beside it). */
const FarmAnimalDock: React.FC<FarmAnimalDockProps> = ({ open, onToggle, onBuy, onHover }) => {
	const food = useGameStore((state) => state.resources.food);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const upgrades = useGameStore((state) => state.farmUpgrades);

	return (
		<div className='farm-animals' data-open={open}>
			<Button size='sm' className='farm-dock-toggle' onClick={onToggle} aria-expanded={open}>
				Animals {open ? '▶' : '◀'}
			</Button>
			{open && (
				<div className='farm-animals-list'>
					{ANIMALS.map((animal) => (
						<AnimalRow
							key={animal.id}
							animal={animal}
							owned={farmLevels[animal.id] || 0}
							upgrades={upgrades}
							food={food}
							onBuy={(count) => onBuy(animal.id, count)}
							onHover={(hovering) => onHover(hovering ? animal.id : null)}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default FarmAnimalDock;
