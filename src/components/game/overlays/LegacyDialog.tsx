import React, { useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { LEGACY_UPGRADES, REBIRTH, CASTLE_UPGRADE, type LegacyUpgradeId } from '@/config/gameConfig';
import { castleModifier, economyTiles, legacyGain, legacyIncomeMultiplier, legacyUpgradeCost } from '@/utils/gameUtils';
import { castleLevelOf } from '@/lib/castleWard';
import { formatNumber, formatPercent } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';
import LegacyIcon from '../LegacyIcon';

const pct = (n: number, digits = 0) => (Math.abs(n * 100) >= 5000 ? formatPercent(n * 100) : `${(n * 100).toFixed(digits)}%`);

const shopText: Record<LegacyUpgradeId, (levels: number) => string> = {
	thrift: (n) => `-${pct(LEGACY_UPGRADES.thrift.effectPerLevel)} tile and building cost per level (now -${pct(n * LEGACY_UPGRADES.thrift.effectPerLevel)}, with Charisma at most -${REBIRTH.discountCapPercent}%)`,
	builders: (n) => `-${pct(LEGACY_UPGRADES.builders.effectPerLevel)} castle build time per level (now -${pct(n * LEGACY_UPGRADES.builders.effectPerLevel)})`,
	mastery: (n) => `+${pct(LEGACY_UPGRADES.mastery.effectPerLevel)} gold per click per level (now +${pct(n * LEGACY_UPGRADES.mastery.effectPerLevel)})`,
	provisions: (n) => `Every new run starts with ${Object.entries(LEGACY_UPGRADES.provisions.bundle)
		.map(([r, v]) => `${formatNumber((v as number) * Math.max(n, 1))} ${r}`)
		.join(', ')}${n === 0 ? ' per level' : ''}`,
};

/**
 * Rebirth and the Legacy shop. A rebirth restarts the run (map, resources, castle, farm, level) in exchange for
 * Legacy points: permanent income and shop upgrades.
 */
const LegacyDialog: React.FC = () => {
	const open = useUiStore((state) => state.legacyOpen);
	const close = useUiStore((state) => state.closeLegacy);
	const tiles = useGameStore((state) => state.tiles);
	const freeTiles = useGameStore((state) => state.freeTiles);
	const prestige = useGameStore((state) => state.prestige);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const rebirth = useGameStore((state) => state.rebirth);
	const buyLegacyUpgrade = useGameStore((state) => state.buyLegacyUpgrade);
	const [confirming, setConfirming] = useState(false);

	if (!open) return null;

	const ownedTiles = economyTiles(tiles, freeTiles); // purchases + 1: the free starting ring does not count
	const castleLevel = castleLevelOf(tiles);
	const gain = legacyGain(castleLevel, ownedTiles);
	const levelOk = castleLevel >= REBIRTH.minCastleLevel;
	const tilesOk = ownedTiles >= REBIRTH.minTiles;
	const idleOk = !castleUpgrade;
	const canRebirth = levelOk && tilesOk && idleOk && gain >= 1;

	const handleClose = () => {
		setConfirming(false);
		close();
	};

	const doRebirth = () => {
		if (rebirth()) {
			audioManager.playSound('fanfare');
			handleClose();
		}
	};

	const Check: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => (
		<div className={ok ? 'text-green-400' : 'text-red-400'}>
			{ok ? '[x]' : '[ ]'} {children}
		</div>
	);

	return (
		<PixelModal title='Legacy' size='md' icon={<PixelIcon name='menu_legacy' alt='' />} onClose={handleClose}>
			<div className='px-card mb-3 text-sm grid grid-cols-3 gap-2 text-center'>
				<div>
					<div className='text-[#a89878]'>Rebirths</div>
					<div className='text-[#f0d27a] text-lg'>{formatNumber(prestige.rebirths)}</div>
				</div>
				<div>
					<div className='text-[#a89878]'>Income bonus</div>
					<div className='text-green-400 text-lg'>+{pct(legacyIncomeMultiplier(prestige) - 1)}</div>
				</div>
				<div>
					<div className='text-[#a89878]'>Legacy</div>
					<div className='text-green-300 text-lg flex items-center justify-center gap-1'>
						<LegacyIcon /> {formatNumber(prestige.legacyPoints)}
					</div>
				</div>
			</div>

			{confirming ? (
				<div className='px-card mb-3 text-sm'>
					<div className='px-h'>Rebirth now?</div>
					<p className='text-[#d8c8a0] mb-2'>
						You gain <b className='text-green-300'>{formatNumber(gain)}</b> Legacy (+{pct(gain * REBIRTH.incomePerPoint)} income
						for ever). The map, resources, castle, farm, level and stat points start again. Your name, hero,
						Legacy and shop upgrades stay.
					</p>
					<div className='flex justify-between'>
						<button className='px-btn' onClick={() => setConfirming(false)}>
							Not yet
						</button>
						<button className='px-btn px-btn-red' onClick={doRebirth}>
							Rebirth
						</button>
					</div>
				</div>
			) : (
				<div className='px-card mb-3 text-sm'>
					<div className='px-h'>Rebirth</div>
					<p className='text-[#d8c8a0] mb-2'>
						Start over with a permanent bonus. A rebirth gives about {formatNumber(gain)} Legacy point{gain === 1 ? '' : 's'} now; a
						higher castle level and more tiles give more (castle level {CASTLE_UPGRADE.maxLevel} is the best you can do).
					</p>
					<div className='mb-3'>
						<Check ok={levelOk}>Castle level {REBIRTH.minCastleLevel}+ (now {castleLevel})</Check>
						<Check ok={tilesOk}>At least {REBIRTH.minTiles} tiles (now {formatNumber(ownedTiles)})</Check>
						<Check ok={idleOk}>No castle upgrade in progress</Check>
					</div>
					<div className='text-xs text-[#a89878] mb-2'>
						Castle bonus today +{pct(castleModifier(castleLevel))} - it starts again from level 1.
					</div>
					<div className='flex justify-center'>
						<button className='px-btn px-btn-gold' disabled={!canRebirth} onClick={() => setConfirming(true)}>
							Rebirth for {formatNumber(gain)} Legacy
						</button>
					</div>
				</div>
			)}

			<div className='px-card text-sm'>
				<div className='px-h'>Legacy shop</div>
				<div className='flex flex-col gap-2'>
					{(Object.keys(LEGACY_UPGRADES) as LegacyUpgradeId[]).map((id) => {
						const def = LEGACY_UPGRADES[id];
						const level = prestige.upgrades[id] ?? 0;
						const maxed = level >= def.maxLevel;
						const cost = legacyUpgradeCost(id, level);
						const affordable = prestige.legacyPoints >= cost;
						return (
							<div key={id} className='flex items-center justify-between gap-3 border-b px-rule pb-2 last:border-b-0'>
								<div>
									<div className='text-[#ecdcb4]'>
										{def.label} <span className='text-[#a89878]'>({level}/{def.maxLevel})</span>
									</div>
									<div className='text-xs text-[#a89878]'>{shopText[id](level)}</div>
								</div>
								<button
									className='px-btn px-btn-sm shrink-0'
									disabled={maxed || !affordable}
									onClick={() => {
										if (buyLegacyUpgrade(id)) audioManager.playSound('purchase');
									}}>
									{maxed ? 'Max' : <><LegacyIcon /> {formatNumber(cost)}</>}
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</PixelModal>
	);
};

export default LegacyDialog;
