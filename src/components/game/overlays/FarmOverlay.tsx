import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import type { ClickInput } from '@/types/game';
import { queueTileTap } from '@/lib/floatText';
import type { Critter } from './MeadowLayer';
import audioManager from '@/utils/audioManager';
import '@/styles/Farm.css';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';
import FarmScene from './FarmScene';
import FarmHud from './FarmHud';
import FarmUpgradeDock from './FarmUpgradeDock';

/**
 * The Farm window: one seamless scene. The pen and its animals fill the whole window, hovering an animal shows its
 * buy card right above it, a corner readout shows the output and the upgrade shelf sits along the bottom.
 */
const FarmOverlay: React.FC = () => {
	const food = useGameStore((state) => state.resources.food);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const farmUpgrades = useGameStore((state) => state.farmUpgrades);
	const purchaseAnimal = useGameStore((state) => state.purchaseAnimal);
	const showFarmWindow = useGameStore((state) => state.showFarmWindow);
	const setShowFarmWindow = useGameStore((state) => state.setShowFarmWindow);
	const claimCritterGift = useGameStore((state) => state.claimCritterGift);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [celebrate, setCelebrate] = useState<string | null>(null);

	useEffect(() => {
		if (!celebrate) return;
		const t = setTimeout(() => setCelebrate(null), 1100);
		return () => clearTimeout(t);
	}, [celebrate]);

	useEffect(() => {
		if (!showFarmWindow) setSelectedId(null);
	}, [showFarmWindow]);

	if (!showFarmWindow) return null;

	// A meadow critter was clicked: gift = some seconds of that resource's income (bigger if golden).
	// The amount rides the click's cursor popup together with the usual click gold.
	const catchCritter = (critter: Critter, _x: number, _y: number, input: ClickInput) => {
		const gift = claimCritterGift({ source: 'farm', type: critter.type, golden: critter.golden }, input);
		if (!gift) return;
		queueTileTap([{ resource: gift.resource, amount: gift.amount }], critter.golden);
		audioManager.playSound('click');
	};

	const buy = (animalId: string, count: number | 'max') => {
		if (purchaseAnimal(animalId, count) > 0) setCelebrate(animalId);
	};

	return (
		<PixelModal
			title='Farm'
			icon={<PixelIcon name='menu_farm' alt='' />}
			size='lg'
			flush
			onClose={() => setShowFarmWindow(false)}>
			<div className='farm-root'>
				<FarmScene
					farmLevels={farmLevels}
					farmUpgrades={farmUpgrades}
					food={food}
					selectedId={selectedId}
					onSelect={setSelectedId}
					onBuy={buy}
					celebrate={celebrate}
					onCatchCritter={catchCritter}
				/>
				<FarmHud />
				<FarmUpgradeDock />
			</div>
		</PixelModal>
	);
};

export default FarmOverlay;
