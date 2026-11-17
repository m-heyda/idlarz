import React, { useState } from 'react';
import { sortedCostEntries } from '@/catalog';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { EMBER_UPGRADES, REBIRTH, type EmberUpgradeId } from '@/config/rebirth';
import { CASTLE_UPGRADE } from '@/config/castle';
import { castleModifier } from '@/utils/game/castle';
import { economyTiles } from '@/utils/game/tiles';
import { emberIncomeBonus, emberIncomeMultiplier, emberUpgradeCost, rebirthStatus } from '@/utils/game/rebirth';
import { biomeArtUrl } from '@/config/biomeArt';
import { castleLevelOf } from '@/lib/castleWard';
import { formatHeaderAmount, formatNumber, formatPercent, tidy } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import { askServerRebirth } from '@/lib/serverRebirth';
import { rebirthRunSummary, rebirthUnlockIntro, rebirthUnlockList, type RebirthRunSummary, type RebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import { useBestiaryStore } from '@/stores/bestiaryStore';
import GameModal from '../GameModal';
import { Button, SectionLabel, Tabs } from '../../../../packages/design-system/src/components/primitives';
import { UpgradeTile } from '../../../../packages/design-system/src/components/upgrade';
import '@/styles/Rebirth.css';
import RebirthUnlockModal from './RebirthUnlockModal';
import EmberIcon from '../EmberIcon';

const pct = (n: number, digits = 0) => (Math.abs(n * 100) >= 5000 ? formatPercent(n * 100) : `${tidy((n * 100).toFixed(digits))}%`);

/** What an Ember shop upgrade gives at level `n` (the same numbers as before; a tile shows it for the level now and for the next one) */
const levelText: Record<EmberUpgradeId, (levels: number) => string> = {
	thrift: (n) => `-${pct(n * EMBER_UPGRADES.thrift.effectPerLevel)} tile and building cost (with Charisma at most -${REBIRTH.discountCapPercent}%)`,
	builders: (n) => `-${pct(n * EMBER_UPGRADES.builders.effectPerLevel)} castle build time`,
	nightwatch: (n) => `+${n * EMBER_UPGRADES.nightwatch.effectPerLevel} h of away time`,
	steward: (n) => `+${pct(n * EMBER_UPGRADES.steward.effectPerLevel)} income while away`,
	deeppockets: (n) => `+${n * EMBER_UPGRADES.deeppockets.effectPerLevel} bag slots, kept through every rebirth`,
	mastery: (n) => `+${pct(n * EMBER_UPGRADES.mastery.effectPerLevel)} gold per click`,
	provisions: (n) =>
		`Every new run starts with ${sortedCostEntries(EMBER_UPGRADES.provisions.bundle)
			.map(([r, v]) => `${formatNumber(v * n)} ${r}`)
			.join(', ')}`,
};

type RebirthTab = 'rebirth' | 'shop';

/**
 * The Ember shop's sections, in display order. A section lists the upgrades (ids of `EMBER_UPGRADES`) that belong to it; this is presentation only. To add a bonus, add it to `EMBER_UPGRADES`
 * and put its id in a section here; an empty section shows `empty` until the first upgrade of that kind exists.
 */
const EMBER_CATEGORIES: readonly { id: string; label: string; ids: readonly EmberUpgradeId[]; empty?: string }[] = [
	{ id: 'economy', label: 'Economy', ids: ['thrift', 'mastery', 'provisions'] },
	{ id: 'time', label: 'Building and away time', ids: ['builders', 'nightwatch', 'steward'] },
	{ id: 'battle', label: 'Battle', ids: [], empty: 'Battle bonuses will come here.' },
	{ id: 'utility', label: 'Utility', ids: ['deeppockets'] },
];

/**
 * Rebirth and the Ember shop, in two tabs. A rebirth restarts the run (map, resources, castle, farm, level) in exchange for Embers: permanent income and shop upgrades.
 * The Rebirth tab (the default) shows the requirements, what the next rebirth would give and the button; only that button needs the requirements. The Ember shop tab is always open, so the
 * bonuses and prices can be browsed (and Embers planned for) before the first rebirth.
 */
const RebirthDialog: React.FC = () => {
	const open = useUiStore((state) => state.rebirthOpen);
	const close = useUiStore((state) => state.closeRebirth);
	const tiles = useGameStore((state) => state.tiles);
	const freeTiles = useGameStore((state) => state.freeTiles);
	const prestige = useGameStore((state) => state.prestige);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const rebirth = useGameStore((state) => state.rebirth);
	const buyEmberUpgrade = useGameStore((state) => state.buyEmberUpgrade);
	const [tab, setTab] = useState<RebirthTab>('rebirth');
	const [confirming, setConfirming] = useState(false);
	const [asking, setAsking] = useState(false);
	// what the rebirth just did (the Embers, the run's numbers and anything it unlocked), shown on the result screen before the dialog closes
	const [result, setResult] = useState<{ run: RebirthRunSummary; intro: RebirthUnlockIntro | null } | null>(null);
	const showToast = useUiStore((state) => state.showToast);

	if (!open) return null;

	// the one rule the dock button and the store's `rebirth` read too
	const status = rebirthStatus({ tiles, freeTiles, castleUpgrade, merchantUpgrades, prestige });
	const { castleLevel, gain, canRebirth } = status;
	const nextUnlock = rebirthUnlockIntro(prestige.rebirths + 1);
	const unlocks = rebirthUnlockList(prestige.rebirths + 1);
	const incomeNow = emberIncomeMultiplier(prestige) - 1;
	const incomeGain = emberIncomeBonus(prestige.legacyEarned + gain) - emberIncomeBonus(prestige.legacyEarned);

	const handleClose = () => {
		setConfirming(false);
		setResult(null);
		close();
	};

	// The server runs the rebirth first (it uploads the game, judges it, computes the Embers and wipes its bag and gear); the browser then starts
	// the new run with the Embers the server named. Without a cloud save this session the browser rebirths on its own, as before.
	const doRebirth = async () => {
		if (asking) return;
		setAsking(true);
		try {
			const answer = await askServerRebirth();
			if (answer.status === 'refused') {
				showToast('The server does not see your rebirth yet. Give the game a few seconds to save, then try again.');
				return;
			}
			// what the run had reached, read before the rebirth wipes it
			const before = useGameStore.getState();
			const ran = {
				ownedTiles: economyTiles(before.tiles, before.freeTiles),
				castleLevel: castleLevelOf(before.tiles),
				level: before.level.level,
				playSeconds: before.playSeconds,
				rates: before.resourceRates as unknown as Record<string, number>,
				kills: Object.values(useBestiaryStore.getState().kills).reduce((sum, n) => sum + n, 0),
				before: before.prestige,
			};
			if (rebirth(answer.status === 'ok' ? answer.gain : undefined)) {
				audioManager.playSound('fanfare');
				const after = useGameStore.getState().prestige;
				setConfirming(false);
				setResult({ run: rebirthRunSummary({ ...ran, after }), intro: rebirthUnlockIntro(after.rebirths) });
			}
		} finally {
			setAsking(false);
		}
	};

	if (result) return <RebirthUnlockModal run={result.run} intro={result.intro} onClose={handleClose} />;

	const confirmCard = (
		<div className='rb-card'>
			<SectionLabel>Rebirth now?</SectionLabel>
			<p className='rb-text'>
				You gain <b className='text-green-300'>{formatHeaderAmount(gain)}</b> Embers (+{pct(incomeGain)} income for ever). The map, resources, castle and farm
				start again. Your name, hero, level, XP, attributes, Embers and shop upgrades stay.
			</p>
			{nextUnlock && (
				<p className='rb-text' style={{ color: '#f0d27a' }}>
					This rebirth unlocks a new land: <b>{nextUnlock.label}</b> (x{nextUnlock.multiplier} output).
				</p>
			)}
			<div className='flex justify-between'>
				<Button onClick={() => setConfirming(false)}>Not yet</Button>
				<Button tone='danger' onClick={doRebirth} disabled={asking}>
					{asking ? 'Asking the server...' : 'Rebirth'}
				</Button>
			</div>
		</div>
	);

	const rebirthTab = (
		<div className='rb-stack'>
			<div className='rb-stats'>
				<div className='rb-stat'>
					<span className='rb-stat-label'>Rebirths</span>
					<span className='rb-stat-value' style={{ color: '#f0d27a' }}>
						{formatHeaderAmount(prestige.rebirths)}
					</span>
				</div>
				<div className='rb-stat'>
					<span className='rb-stat-label'>Income bonus</span>
					<span className='rb-stat-value' style={{ color: '#5ee07a' }}>
						+{pct(incomeNow)}
					</span>
				</div>
				<div className='rb-stat'>
					<span className='rb-stat-label'>Embers</span>
					<span className='rb-stat-value' style={{ color: '#86efac' }}>
						<EmberIcon /> {formatHeaderAmount(prestige.legacyPoints)}
					</span>
				</div>
			</div>

			{confirming ? (
				confirmCard
			) : (
				<>
					<div className='rb-card'>
						<SectionLabel>Requirements</SectionLabel>
						<ul className='rb-reqs'>
							{status.requirements.map((req) => (
								<li key={req.id} className='rb-req' data-met={req.met}>
									<span className='rb-check' aria-hidden>
										{req.met ? '✓' : '✕'}
									</span>
									<span className='rb-req-label'>
										{req.id === 'castle' ? `Castle level ${req.needed}+` : req.id === 'tiles' ? `At least ${req.needed} tiles` : req.label}
									</span>
									{req.id !== 'idle' ? (
										<>
											<span className='rb-req-now'>
												{formatHeaderAmount(req.current)} / {formatHeaderAmount(req.needed)}
											</span>
											<span className='rb-req-bar' aria-hidden>
												<i style={{ width: `${Math.min(100, Math.max(0, (req.current / Math.max(1, req.needed)) * 100))}%` }} />
											</span>
										</>
									) : (
										<span className='rb-req-now'>{req.met ? 'Done' : 'Wait for it to finish'}</span>
									)}
									<span className='sr-only'>{req.met ? 'done' : 'not done yet'}</span>
								</li>
							))}
						</ul>
					</div>

					<div className='rb-card'>
						<SectionLabel>Next rebirth</SectionLabel>
						<div className='rb-gain'>
							<div className='rb-gain-cell'>
								<span className='rb-stat-label'>You would earn</span>
								<span className='rb-gain-value' style={{ color: '#86efac' }} data-testid='rebirth-gain'>
									<EmberIcon /> +{formatHeaderAmount(gain)} Ember{gain === 1 ? '' : 's'}
								</span>
							</div>
							<div className='rb-gain-cell'>
								<span className='rb-stat-label'>Income bonus</span>
								<span className='rb-gain-value' style={{ color: '#5ee07a' }}>
									+{pct(incomeGain, 1)}
								</span>
								<span className='rb-gain-sub'>
									+{pct(incomeNow, 1)} now, +{pct(incomeNow + incomeGain, 1)} after
								</span>
							</div>
						</div>
						<p className='rb-note'>
							A higher castle level and more tiles give more Embers (castle level {CASTLE_UPGRADE.maxLevel} is the best you can do). The castle bonus today is +
							{pct(castleModifier(castleLevel))}; it starts again from level 1.
						</p>
						{unlocks.length > 0 && (
							<div className='rb-unlocks'>
								<span className='rb-stat-label'>You also unlock</span>
								<ul className='rb-unlock-list'>
									{unlocks.map((line) => (
										<li key={line.id} className='rb-unlock'>
											{line.art && biomeArtUrl(line.art) ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img className='rb-unlock-art' src={biomeArtUrl(line.art)} alt='' />
											) : (
												<span className='rb-unlock-dot' aria-hidden>
													<i />
												</span>
											)}
											<b>{line.label}</b>
											{line.detail && <span className='ds-dim'>{line.detail}</span>}
										</li>
									))}
								</ul>
							</div>
						)}
						<div className='flex justify-center'>
							<Button tone='gold' disabled={!canRebirth} onClick={() => setConfirming(true)}>
								Rebirth for {formatHeaderAmount(gain)} Embers
							</Button>
						</div>
						{!canRebirth && <p className='rb-note rb-note-center'>Meet every requirement above to rebirth. The Ember shop is open while you work on it.</p>}
					</div>
				</>
			)}
		</div>
	);

	const shopTab = (
		<div className='rb-stack'>
			<div className='rb-card rb-shop-head'>
				<span>
					Your Embers
					<b className='rb-embers'>
						<EmberIcon /> {formatHeaderAmount(prestige.legacyPoints)}
					</b>
				</span>
				<span className='ds-dim'>Next rebirth: +{formatHeaderAmount(gain)}</span>
			</div>
			{EMBER_CATEGORIES.map((cat) => (
				<div className='rb-shop-cat' key={cat.id}>
					<SectionLabel>{cat.label}</SectionLabel>
					{cat.ids.length === 0 ? (
						<p className='rb-note'>{cat.empty ?? 'More upgrades will come here.'}</p>
					) : (
						<div className='ds-ups'>
							<div className='ds-ups-grid'>
								{cat.ids.map((id) => {
									const def = EMBER_UPGRADES[id];
									const level = prestige.upgrades[id] ?? 0;
									const maxed = level >= def.maxLevel;
									const cost = emberUpgradeCost(id, level);
									return (
										<UpgradeTile
											key={id}
											name={def.label}
											level={level}
											maxLevel={def.maxLevel}
											now={level > 0 ? levelText[id](level) : undefined}
											next={maxed ? undefined : levelText[id](level + 1)}
											cost={cost}
											costText={formatHeaderAmount(cost)}
											costNode={
												<span className='ds-cost'>
													<EmberIcon /> {formatHeaderAmount(cost)}
												</span>
											}
											have={prestige.legacyPoints}
											shortText={`Need ${formatHeaderAmount(Math.max(0, cost - prestige.legacyPoints))} more`}
											maxLabel='Max level'
											onBuy={() => {
												buyEmberUpgrade(id);
											}}
										/>
									);
								})}
							</div>
						</div>
					)}
				</div>
			))}
		</div>
	);

	return (
		<GameModal title='Rebirth' size='lg' onClose={handleClose}>
			<div className='rb-root'>
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as RebirthTab)}
					items={[
						{ id: 'rebirth', label: 'Rebirth' },
						{ id: 'shop', label: 'Ember shop' },
					]}
				/>
				{tab === 'rebirth' ? rebirthTab : shopTab}
			</div>
		</GameModal>
	);
};

export default RebirthDialog;
