import React, { useEffect, useState } from 'react';
import { IDOL_RULES } from '@/config/buildings';
import { idolDef } from '@/catalog/idols';
import { buildingKindLabel, buildingsOfBiome } from '@/catalog/buildings';
import { buildTimeCutPct } from '@/lib/buildTimeCut';
import { idolValueText } from '@/lib/idolEconomy';
import type { PrestigeState } from '@/types/game';
import { limitOf } from '@/lib/limits';
import { buildingUpgradeDuration, ownedOfBiome } from '@/lib/buildings';
import { buildingEffectText } from '@/lib/buildingText';
import { formatTime } from '@/utils/formatters';
import { buildOptions, type BuildOption, type OwnedOption } from '@/lib/buildingMenu';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import audioManager from '@/utils/audioManager';
import { getTile } from '@/utils/world';
import { monsterAt } from '@/lib/monsters';
import CostGrid from '../CostGrid';
import GameModal from '../GameModal';
import { Button, DiamondLevel, HoverTip } from '../../../../packages/design-system/src/components/primitives';
import { TipLine, Tooltip } from '../../../../packages/design-system/src/components/tooltips';
import '@/styles/BuildModal.css';

const Art: React.FC<{ def: BuildOption['def'] }> = ({ def }) => (
	<span className='build-art'>
		{/* eslint-disable-next-line @next/next/no-img-element */}
		<img src={def.art} alt='' style={{ imageRendering: 'pixelated' }} />
	</span>
);

const Head: React.FC<{ def: BuildOption['def']; extra?: string; details?: React.ReactNode }> = ({ def, extra, details }) => (
	<div className='build-head'>
		<span className='build-name'>{def.label}</span>
		<span className={`build-kind build-kind-${def.kind}`}>{buildingKindLabel(def)}</span>
		{extra && <span className='build-extra'>{extra}</span>}
		{details && (
			<HoverTip tip={details} placement='above' align='center'>
				<span className='bh-details'>Details</span>
			</HoverTip>
		)}
	</div>
);

/**
 * What an Idol is and does, in plain lines: the effect per level with the value now and at the cap, what the rebirth keeps, how it is upgraded. `coming soon` marks an effect the game does not apply yet (none today). The numbers are `IDOL_RULES` and `limitOf('idolMaxLevel', { prestige })`.
 */
export const IdolInfo: React.FC<{ id: string; remembered: number; buildTimePct?: number; prestige?: PrestigeState }> = ({
	id,
	remembered,
	buildTimePct = 0,
	prestige,
}) => {
	const idol = idolDef(id);
	if (!idol) return null;
	const max = limitOf('idolMaxLevel', { prestige });
	const shown = Math.max(1, remembered);
	return (
		<div className='build-idol'>
			<p className='build-idol-effect'>
				{idol.effect === 'luck' ? `+${IDOL_RULES.luckPerLevel} Luck per level` : `+${IDOL_RULES.perLevel} % ${idol.effectText} per level`}
				{!idol.applied && <span className='build-soon'> (coming soon: not applied yet)</span>}
			</p>
			<p className='build-idol-levels'>
				Level {shown}/{max} = {idolValueText(idol, shown)}
				{shown < max ? `; level ${max} = ${idolValueText(idol, max)}` : ''}
			</p>
			<ul className='build-idol-notes'>
				<li>Kept when you rebirth: its level stays, rebuild it free on any {idol.biome} tile.</li>
				<li>
					Upgrade up to level {max} as your castle grows; each level, the first one too, takes a builder (
					{[0, 1, 2, 3, 4].map((l) => formatTime(buildingUpgradeDuration(l, prestige, buildTimePct, 'idol'))).join(', ')}).
				</li>
				<li>The Ember shop&apos;s Idol Mastery raises the cap (coming soon).</li>
			</ul>
		</div>
	);
};

/** The shortage is already visible (red costs, a disabled button), so it is not printed under every card; any other refusal still is. */
const NOT_ENOUGH = 'Not enough resources';

/** One collapsible group of the Build window: a header button with the name and the count, and the cards under it while it is open. */
const Group: React.FC<{ title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({
	title,
	count,
	open,
	onToggle,
	children,
}) => (
	<section className='bh-group'>
		<button type='button' className='bh-group-head' aria-expanded={open} onClick={onToggle}>
			<span className='bh-group-arrow' data-open={open}>
				▸
			</span>
			<span className='bh-group-title'>{title}</span>
			<span className='bh-group-count'>{count}</span>
		</button>
		{open && <div className='build-list bh-grid'>{children}</div>}
	</section>
);

/** "Build here": the buildings of the tile's biome with art, output and price, in two groups you can fold: "Build new" (not built yet) and "Already owned" (standing, with a Buy for one more copy when the slots allow it). */
const BuildBody: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const close = useUiStore((state) => state.closeBuildModal);
	const buildBuilding = useGameStore((state) => state.buildBuilding);
	// re-evaluate whenever resources or the map change, so prices go green/red live
	const tiles = useGameStore((state) => state.tiles);
	useGameStore((state) => state.resources);
	const monsters = useGameStore((state) => state.monsters);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const prestige = useGameStore((state) => state.prestige);
	const equipment = useGameStore((state) => state.equipment);
	const buildTimePct = buildTimeCutPct(tiles, idolLevels, equipment);
	const tile = getTile(tiles, x, y);
	const free = !!tile && !tile.building;
	const { builds, maxed } = buildOptions(useGameStore, x, y);
	const [open, setOpen] = useState({ fresh: true, owned: true });

	// the tile got a building, or nothing can be offered anymore: nothing left to choose
	// a monster standing on the tile closes the window too: it has to be defeated before anything is built here
	const blocked = !!monsterAt(monsters, x, y);
	useEffect(() => {
		if (!free || blocked || builds.length === 0) close();
	}, [free, blocked, builds.length, close]);
	if (!free || blocked) return null;

	// one fixed place per building type (Producer, Extractor, Idol, then the general buildings) inside each group
	const position = new Map(buildingsOfBiome(tile?.biome ?? '').map((d, i) => [d.id, i]));
	const at = (id: string) => position.get(id) ?? position.size;

	const build = (o: BuildOption) => {
		if (o.problem) return;
		audioManager.playSound('click');
		void buildBuilding?.(x, y, o.def.id);
		close();
	};
	/** The key line of an option: what it makes per hour and per level (an Idol: its effect per level), kept to one line; the rest is in the hover card */
	const keyLine = (def: BuildOption['def']) => {
		if (def.kind === 'idol') {
			const idol = idolDef(def.id);
			if (!idol) return null;
			const effect = idol.effect === 'luck' ? `+${IDOL_RULES.luckPerLevel} Luck per level` : `+${IDOL_RULES.perLevel} % ${idol.effectText} per level`;
			return (
				<div className='bh-key'>
					<span style={{ color: '#c9a6ff' }}>{effect}</span>
					<span className='bh-key-more'>
						{' '}
						· level {limitOf('idolMaxLevel', { prestige })} = {idolValueText(idol, limitOf('idolMaxLevel', { prestige }))}
					</span>
					{!idol.applied && <span className='build-soon'> (coming soon: not applied yet)</span>}
				</div>
			);
		}
		const text = buildingEffectText(def, ownedOfBiome(tiles, def.biome));
		if (!text) return null;
		return (
			<div className='bh-key' title={text.produces}>
				<span style={{ color: '#5ee07a' }}>{text.produces.replace(/\.$/, '')}</span>
				<span className='bh-key-more'> · {text.perLevel.replace(/\.$/, '')}</span>
			</div>
		);
	};

	/** The long explanation that used to fill the card, on hover now */
	const details = (def: BuildOption['def'], remembered?: number) => {
		const text = buildingEffectText(def, ownedOfBiome(tiles, def.biome));
		return (
			<Tooltip title={def.label} subtitle={buildingKindLabel(def)} className='ds-tip-compact'>
				{text && (
					<>
						<TipLine>{text.perLevel}</TipLine>
						<TipLine>{text.scale}</TipLine>
						<TipLine>{text.levels}</TipLine>
					</>
				)}
				{def.kind === 'idol' && <IdolInfo id={def.id} remembered={remembered ?? 0} buildTimePct={buildTimePct} prestige={prestige} />}
			</Tooltip>
		);
	};

	const fresh = builds.filter((o) => o.owned === 0).sort((a, b) => at(a.def.id) - at(b.def.id));
	const owned: { def: BuildOption['def']; level: number; owned: number; buy: BuildOption | null }[] = [
		...builds.filter((o) => o.owned > 0).map((o) => ({ def: o.def, level: o.level, owned: o.owned, buy: o })),
		...maxed.map((o: OwnedOption) => ({ def: o.def, level: o.level, owned: o.owned, buy: null })),
	].sort((a, b) => at(a.def.id) - at(b.def.id));
	const maxLevelOf = (def: BuildOption['def']) => (def.kind === 'idol' ? limitOf('idolMaxLevel', { prestige }) : limitOf('buildingMaxLevel', { prestige }));

	const buyButton = (o: BuildOption) => (
		<div className='bh-side'>
			<Button tone='gold' className='build-action' disabled={!!o.problem} title={o.problem ?? undefined} onClick={() => build(o)}>
				Buy
			</Button>
		</div>
	);

	return (
		<GameModal title='Build here' width={1080} onClose={close}>
			{fresh.length > 0 && (
				<Group title='Build new' count={fresh.length} open={open.fresh} onToggle={() => setOpen((o) => ({ ...o, fresh: !o.fresh }))}>
					{fresh.map((o) => (
						<div key={o.def.id} className={`bh-row${o.problem ? ' build-row-off' : ''}`}>
							<Art def={o.def} />
							<div className='bh-info'>
								<Head def={o.def} details={details(o.def, o.remembered)} />
								<p className='build-blurb'>{o.def.blurb}</p>
								{keyLine(o.def)}
								<div className='build-foot'>
									{o.remembered ? <span className='build-free'>Free: learned at level {o.remembered}</span> : <CostGrid cost={o.cost} />}
								</div>
								{o.problem && o.problem !== NOT_ENOUGH && <p className='build-problem'>{o.problem}</p>}
							</div>
							{buyButton(o)}
						</div>
					))}
				</Group>
			)}
			{owned.length > 0 && (
				<Group title='Already owned' count={owned.length} open={open.owned} onToggle={() => setOpen((o) => ({ ...o, owned: !o.owned }))}>
					{owned.map((o) => (
						<div key={o.def.id} className={`bh-row${o.buy?.problem ? ' build-row-off' : ''}`}>
							<Art def={o.def} />
							<div className='bh-info'>
								<Head def={o.def} extra={o.owned > 1 ? `${o.owned} built` : 'built'} details={details(o.def, o.buy?.remembered)} />
								<span title={`Level ${o.level} of ${maxLevelOf(o.def)}`}>
									<DiamondLevel level={o.level} max={maxLevelOf(o.def)} small />
								</span>
								{keyLine(o.def)}
								{o.buy && (
									<div className='build-foot'>
										<span className='build-extra'>One more:</span>
										<CostGrid cost={o.buy.cost} />
									</div>
								)}
								{o.buy?.problem && o.buy.problem !== NOT_ENOUGH && <p className='build-problem'>{o.buy.problem}</p>}
							</div>
							{o.buy ? buyButton(o.buy) : null}
						</div>
					))}
				</Group>
			)}
		</GameModal>
	);
};

/** The Build window, mounted once on the page; the ui store says whether and for which tile it is open. */
const BuildModal: React.FC = () => {
	const target = useUiStore((state) => state.buildModal);
	return target ? <BuildBody x={target.x} y={target.y} /> : null;
};

export default BuildModal;
