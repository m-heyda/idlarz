import React, { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/Farm.css';
import FarmScene from './FarmScene';
import FarmHud from './FarmHud';
import FarmUpgradeDock from './FarmUpgradeDock';
import FarmAnimalDock, { ANIMAL_DOCK_WIDTH } from './FarmAnimalDock';

/**
 * The Farm window: one meadow filling the whole window with the pen and its animals in it, a corner readout, the animal
 * shop along the right edge and the upgrade drawer sliding up from the bottom.
 */
const FarmOverlay: React.FC = () => {
	const purchaseAnimal = useGameStore((state) => state.purchaseAnimal);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const [highlightId, setHighlightId] = useState<string | null>(null);
	const [celebrate, setCelebrate] = useState<string | null>(null);
	// which panels are folded is remembered between visits (lib/uiPrefs)
	const animalsOpen = useUiStore((state) => state.farmAnimalsOpen);
	const upgradesOpen = useUiStore((state) => state.farmUpgradesOpen);
	const hudOpen = useUiStore((state) => state.farmHudOpen);
	const setPref = useUiStore((state) => state.setPref);
	const setUpgradesOpen = useCallback((open: boolean) => setPref('farmUpgradesOpen', open), [setPref]);

	useEffect(() => {
		if (!celebrate) return;
		const t = setTimeout(() => setCelebrate(null), 1100);
		return () => clearTimeout(t);
	}, [celebrate]);

	const buy = (animalId: string, count: number) => {
		if (purchaseAnimal(animalId, count) > 0) setCelebrate(animalId);
	};

	return (
		<div className='farm-root'>
			<FarmScene
				farmLevels={farmLevels}
				highlightId={highlightId}
				celebrate={celebrate}
				insets={{
					right: animalsOpen ? ANIMAL_DOCK_WIDTH : 0,
					hudOpen,
				}}
				onPointerDown={() => upgradesOpen && setUpgradesOpen(false)}
			/>
			<FarmHud open={hudOpen} onToggle={() => setPref('farmHudOpen', !hudOpen)} />
			<FarmAnimalDock open={animalsOpen} onToggle={() => setPref('farmAnimalsOpen', !animalsOpen)} onBuy={buy} onHover={setHighlightId} />
			<FarmUpgradeDock open={upgradesOpen} onOpenChange={setUpgradesOpen} />
		</div>
	);
};

export default FarmOverlay;
