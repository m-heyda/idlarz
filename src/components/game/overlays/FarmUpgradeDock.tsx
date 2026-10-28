import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { FARM_UPGRADES, type FarmUpgradeId } from '@/config/gameConfig';
import { canAffordBundle, farmUpgradeCost, farmUpgradeLevel } from '@/utils/gameUtils';
import audioManager from '@/utils/audioManager';
import CostList from '../CostList';
import { TipButton } from './Merchant/TipButton';

const IDS = Object.keys(FARM_UPGRADES) as FarmUpgradeId[];

/** How long the drawer takes to slide shut (a little over the transition in Farm.css) */
const CLOSE_MS = 300;

interface FarmUpgradeDockProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** The cards of the drawer. They follow the store (resources tick ten times a second), so they are only mounted while the drawer shows. */
const UpgradeCards: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const upgrades = useGameStore((state) => state.farmUpgrades);
	const buy = useGameStore((state) => state.buyFarmUpgrade);

	return (
		<>
			{IDS.map((id) => {
				const def = FARM_UPGRADES[id];
				const level = farmUpgradeLevel(upgrades, id);
				const maxed = level >= def.maxLevel;
				const cost = farmUpgradeCost(id, level);
				const affordable = !maxed && canAffordBundle(resources, cost);
				return (
					<div key={id} className='farm-up' data-ok={affordable} data-maxed={maxed}>
						<div className='farm-up-head'>
							<span className='farm-up-name'>{def.label}</span>
							<span className='farm-up-lvl'>
								{level}/{def.maxLevel}
							</span>
						</div>
						<div className='farm-up-effect'>{level > 0 ? def.description(level) : 'not built yet'}</div>
						<TipButton
							className='px-btn px-btn-sm w-full'
							label={maxed ? 'Max' : 'Upgrade'}
							disabled={!affordable}
							onClick={() => {
								if (buy(id)) {
									audioManager.playSound('purchase');
								}
							}}
							tip={
								<>
									<div className='px-tip-title'>
										{def.label} {level}/{def.maxLevel}
									</div>
									{maxed ? (
										<div className='px-tip-muted'>Fully upgraded.</div>
									) : (
										<>
											<div className='text-[#7ac27a]'>Next: {def.description(level + 1)}</div>
											<CostList cost={cost} />
											{!affordable && <div className='px-tip-muted'>Not enough resources.</div>}
										</>
									)}
								</>
							}
						/>
					</div>
				);
			})}
		</>
	);
};

/**
 * The farm's upgrade drawer: it slides up over the bottom of the scene on a blurred backdrop (the farm stays visible behind
 * it) and holds feed, hen house, dairy, tannery and the pen. Esc or a press on the meadow closes it. The next level and the
 * price are in each button's hover card.
 */
const FarmUpgradeDock: React.FC<FarmUpgradeDockProps> = ({ open, onOpenChange }) => {
	// the cards stay mounted while the drawer slides shut, then go
	const [shown, setShown] = useState(open);
	useEffect(() => {
		if (open) {
			setShown(true);
			return;
		}
		const t = setTimeout(() => setShown(false), CLOSE_MS);
		return () => clearTimeout(t);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		// Esc peels one layer: it shuts the drawer and stops there, the next Esc closes the Farm window (the modal listens on window)
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.stopPropagation();
			onOpenChange(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onOpenChange]);

	return (
		<div className='farm-dock' data-open={open}>
			<button className='farm-dock-toggle' onClick={() => onOpenChange(!open)} aria-expanded={open}>
				Upgrades {open ? '▼' : '▲'}
			</button>
			<div className='farm-drawer'>
				{shown && <UpgradeCards />}
			</div>
		</div>
	);
};

export default FarmUpgradeDock;
