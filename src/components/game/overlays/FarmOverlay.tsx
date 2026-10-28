import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
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
	const [animalsOpen, setAnimalsOpen] = useState(true);
	const [upgradesOpen, setUpgradesOpen] = useState(false);
	const [hudOpen, setHudOpen] = useState(true);

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
				onPointerDown={() => setUpgradesOpen(false)}
			/>
			<FarmHud open={hudOpen} onToggle={() => setHudOpen(!hudOpen)} />
			<FarmAnimalDock open={animalsOpen} onToggle={() => setAnimalsOpen(!animalsOpen)} onBuy={buy} onHover={setHighlightId} />
			<FarmUpgradeDock open={upgradesOpen} onOpenChange={setUpgradesOpen} />
		</div>
	);
};

export default FarmOverlay;
