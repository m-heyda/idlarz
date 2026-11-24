import React, { useState } from 'react';
import { sortedCostEntries } from '@/catalog';
import { useUiStore } from '@/stores/uiStore';
import { useWindowStore } from '@/stores/windowStore';
import { useGameStore } from '@/stores/gameStore';
import { EMBER_DISABLED, EMBER_UPGRADES, REBIRTH, type EmberUpgradeId } from '@/config/rebirth';
import { limitOf } from '@/lib/limits';
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
import GameWindow from '../GameWindow';
import { Button, SectionLabel, Tabs } from '../../../../packages/design-system/src/components/primitives';
import { UpgradeTile } from '../../../../packages/design-system/src/components/upgrade';
import '@/styles/Rebirth.css';
import RebirthUnlockModal from './RebirthUnlockModal';
import RebirthConfirmModal, { type KeepCandidate } from './RebirthConfirmModal';
import { keepCandidates, keepSlots } from '@/lib/rebirthKeep';
import { notify } from '@/lib/notices';
import EmberIcon from '../EmberIcon';

const pct = (n: number, digits = 0) => (Math.abs(n * 100) >= 5000 ? formatPercent(n * 100) : `${tidy((n * 100).toFixed(digits))}%`);

/** What an Ember shop upgrade gives at level `n` (a tile shows it for the level now and for the next one) */
const levelText: Record<EmberUpgradeId, (levels: number) => string> = {
	thrift: (n) => `-${pct(n * EMBER_UPGRADES.thrift.effectPerLevel)} tile and building cost (with Charisma at most -${REBIRTH.discountCapPercent}%)`,
	charter: (n) =>
		`The tile discount can go up to ${REBIRTH.discountCapPercent + n * EMBER_UPGRADES.charter.effectPerLevel}% (Charisma, Thrift and Bulk Discount add up)`,
	builders: (n) => `-${pct(n * EMBER_UPGRADES.builders.effectPerLevel)} castle build time`,
	buildtime: (n) => `-${pct(n * EMBER_UPGRADES.buildtime.effectPerLevel)} build time of Producers and Extractors`,
	idoltime: (n) => `-${pct(n * EMBER_UPGRADES.idoltime.effectPerLevel)} build time of Idols`,
	nightwatch: (n) => `+${n * EMBER_UPGRADES.nightwatch.effectPerLevel} h of away time`,
	steward: (n) => `+${pct(n * EMBER_UPGRADES.steward.effectPerLevel)} income while away`,
	vigil: (n) => (n > 0 ? 'Away income 100% and up to 72 h of away time' : 'Away income 100% and up to 72 h of away time (one-time)'),
	deeppockets: (n) => `+${n * EMBER_UPGRADES.deeppockets.effectPerLevel} bag slots, kept through every rebirth`,
	mastery: (n) => `+${pct(n * EMBER_UPGRADES.mastery.effectPerLevel)} gold per click`,
	miningpower: () => 'Every click on a rock counts as 2 clicks (one-time)',
	startgold: (n) => `Every new run starts at ${EMBER_UPGRADES.startgold.steps[Math.min(n, EMBER_UPGRADES.startgold.steps.length - 1)]} base gold per second`,
	provisions: (n) =>
		`Every new run starts with ${sortedCostEntries(EMBER_UPGRADES.provisions.bundle)
			.map(([r, v]) => `${formatNumber(v * n)} ${r}`)
			.join(', ')}`,
	haggler: (n) => `+${pct(n * EMBER_UPGRADES.haggler.effectPerLevel)} gold from everything you sell`,
	fortune: (n) => `+${n * EMBER_UPGRADES.fortune.effectPerLevel} Luck for chests and kills`,
	artisan: (n) => `+${n * EMBER_UPGRADES.artisan.effectPerLevel} Luck on crafted gear: a better chance of the higher rarities`,
	overseer: (n) => `+${pct(n * EMBER_UPGRADES.overseer.effectPerLevel)} income from every resource, gold included`,
	skinner: (n) => `+${pct(n * EMBER_UPGRADES.skinner.effectPerLevel)} meat and hide from your animals`,
	tithe: (n) => `+${pct(n * EMBER_UPGRADES.tithe.effectPerLevel)} Embers from every rebirth`,
	tempo: (n) => `+${n * EMBER_UPGRADES.tempo.effectPerLevel}% attack speed`,
	precision: (n) => `+${n * EMBER_UPGRADES.precision.effectPerLevel}% crit chance`,
	execution: (n) => `+${n * EMBER_UPGRADES.execution.effectPerLevel}% chance that a crit is a super crit`,
	brawn: (n) => `+${n * EMBER_UPGRADES.brawn.effectPerLevel}% damage with physical weapons`,
	sorcery: (n) => `+${n * EMBER_UPGRADES.sorcery.effectPerLevel}% damage with staves and wands`,
	bloodthirst: (n) => `+${n * EMBER_UPGRADES.bloodthirst.effectPerLevel}% life leech`,
	vigor: (n) => `+${n * EMBER_UPGRADES.vigor.effectPerLevel} HP regenerated per second`,
	potion: () => 'Auto-potion: the hero drinks potions on their own in a fight (one-time)',
	castlecap: (n) => `Castle level cap ${10 + n * EMBER_UPGRADES.castlecap.effectPerLevel}`,
	buildcap: (n) => `Producers and Extractors go up to level ${5 + n * EMBER_UPGRADES.buildcap.effectPerLevel} (the castle level still gates each level)`,
	idolcap: (n) => `Idols go up to level ${5 + n * EMBER_UPGRADES.idolcap.effectPerLevel}`,
	decree: () => 'The castle bonus counts double (one-time)',
	extrabuilder: (n) => `+${n * EMBER_UPGRADES.extrabuilder.effectPerLevel} builder`,
	workbench: (n) => `+${n * EMBER_UPGRADES.workbench.effectPerLevel} crafting speed: batches finish faster`,
	nightshift: (n) => `+${n * EMBER_UPGRADES.nightshift.effectPerLevel} hours a crafting batch runs without you (8 at the start)`,
	thrifty: (n) => `-${n * EMBER_UPGRADES.thrifty.effectPerLevel}% of the resources every craft takes`,
	buildslots: (n) =>
		`+${n * EMBER_UPGRADES.buildslots.effectPerLevel} copy of every Producer and Extractor on the map (1 at the start, 4 at most with the Gem shop)`,
	craftslots: (n) => `+${n * EMBER_UPGRADES.craftslots.effectPerLevel} crafting queue slot (3 at the start, 5 at most)`,
	questrarity: () => 'A better chance of a higher quest rarity (comes with quests)',
	questslots: () => 'More active quests at once (comes with quests)',
};

type RebirthTab = 'rebirth' | 'shop';

/**
 * The Ember shop's sections, in display order. A section lists the upgrades (ids of `EMBER_UPGRADES`) that belong to it; this is presentation only. To add a bonus, add it to `EMBER_UPGRADES`
 * and put its id in a section here; an empty section shows `empty` until the first upgrade of that kind exists.
 */
const EMBER_CATEGORIES: readonly { id: string; label: string; ids: readonly EmberUpgradeId[]; empty?: string }[] = [
	{
		id: 'economy',
		label: 'Economy',
		ids: ['mastery', 'miningpower', 'overseer', 'haggler', 'skinner', 'fortune', 'artisan', 'tithe', 'thrift', 'charter', 'startgold', 'provisions'],
	},
	{ id: 'time', label: 'Build and away time', ids: ['builders', 'buildtime', 'idoltime', 'nightwatch', 'steward', 'vigil'] },
	{ id: 'caps', label: 'Caps and builders', ids: ['castlecap', 'buildcap', 'idolcap', 'extrabuilder', 'buildslots', 'craftslots', 'decree'] },
	{ id: 'battle', label: 'Battle', ids: ['tempo', 'precision', 'execution', 'brawn', 'sorcery', 'bloodthirst', 'vigor', 'potion'] },
	{ id: 'utility', label: 'Utility', ids: ['deeppockets', 'workbench', 'nightshift', 'thrifty'] },
	{ id: 'quests', label: 'Quests (coming soon)', ids: ['questrarity', 'questslots'] },
];

/**
 * Rebirth and the Ember shop, in two tabs. A rebirth restarts the run (map, resources, castle, farm, level) in exchange for Embers: permanent income and shop upgrades.
 * The Rebirth tab (the default) shows the requirements, what the next rebirth would give and the button; only that button needs the requirements. The Ember shop tab is always open, so the
 * bonuses and prices can be browsed (and Embers planned for) before the first rebirth.
 */
const RebirthDialog: React.FC = () => {
	const open = useWindowStore((state) => state.order.includes('rebirth'));
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
	const bag = useGameStore((state) => state.bag);
	const equipment = useGameStore((state) => state.equipment);

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
	const doRebirth = async (keep: KeepCandidate[] = []) => {
		if (asking) return;
		setAsking(true);
		try {
			const answer = await askServerRebirth(keep.map((c) => c.ref));
			if (answer.status === 'refused') {
				notify(
					answer.badKeep
						? 'Your bag changed, so the chosen pieces could not be kept. Choose again.'
						: 'The server does not see your rebirth yet. Give the game a few seconds to save, then try again.',
					'error',
				);
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
			if (rebirth(answer.status === 'ok' ? answer.gain : undefined, answer.status === 'ok' ? answer.kept : [])) {
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

	const confirmModal = confirming ? (
		<RebirthConfirmModal
			gain={gain}
			incomeText={`+${pct(incomeGain)}`}
			unlockLabel={nextUnlock ? `${nextUnlock.label} (x${nextUnlock.multiplier} output)` : undefined}
			slots={keepSlots(prestige.rebirths + 1)}
			candidates={keepCandidates(bag, equipment)}
			asking={asking}
			onCancel={() => setConfirming(false)}
			onConfirm={(keep) => void doRebirth(keep)}
		/>
	) : null;

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

			{
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
							A higher castle level and more tiles give more Embers (castle level {limitOf('castleMaxLevel', { prestige })} is the best you can do). The castle
							bonus today is +{pct(castleModifier(castleLevel))}; it starts again from level 1.
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
			}
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
									// a one-time upgrade granted for free (an account from before the reworked shop) shows as owned
									const level = prestige.upgrades[id] ?? (prestige.grants?.includes(id) ? 1 : 0);
									const maxed = level >= def.maxLevel;
									const locked = EMBER_DISABLED.has(id); // quests are not in the game yet
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
											state={locked ? 'short' : undefined}
											shortText={locked ? 'Coming soon' : `Need ${formatHeaderAmount(Math.max(0, cost - prestige.legacyPoints))} more`}
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
		<GameWindow
			id='rebirth'
			title='Rebirth'
			width={1040}
			height={700}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as RebirthTab)}
					items={[
						{ id: 'rebirth', label: 'Rebirth' },
						{ id: 'shop', label: 'Ember shop' },
					]}
				/>
			}
		>
			<div className='rb-root'>{tab === 'rebirth' ? rebirthTab : shopTab}</div>
			{confirmModal}
		</GameWindow>
	);
};

export default RebirthDialog;
