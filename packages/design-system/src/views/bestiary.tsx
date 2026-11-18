import React, { useMemo, useState } from 'react';
import { Badge, Button, DiamondLevel, Inset, Panel, ProgressBar } from '../components/primitives';
import { compact } from '../logic';

// The Bestiary content (IDL-322, IDL-336): a summary strip, biome goals, a grid of monster cards and a paper detail with lore, records, the mastery ladder with Claim, stats with level controls and the drop table.
// It is data in, callbacks out: the game feeds it from the server's report (`src/components/game/BestiaryWindow.tsx`), Storybook from the catalogs (`Monster catalogue`). It lays itself out from its **own** width
// (a CSS container, `ds-bst`), so it follows the window when the player drags the resize corner, not the screen.

const INK = '#2b1d0e';
const MUTED = '#8a7a5a';

export interface BestiaryTier {
	kills: number;
	reveal?: 'stats' | 'drops';
	/** What the tier gives, as text ("+2% damage dealt") */
	text: string;
	gems: number;
}

export interface BestiaryDropRow {
	label: string;
	value: string;
	/** `rare` and `epic` tint the value like the item rarities; default is plain ink */
	tone?: 'plain' | 'good' | 'rare' | 'epic';
}

export interface BestiaryEntry {
	id: string;
	name: string;
	family: string;
	tags: readonly string[];
	lore: string;
	boss: boolean;
	biome: string;
	biomeLabel: string;
	/** Where and when it appears ("Plains, 2-9 tiles from the castle, from rebirth 1") */
	where: string;
	icon: string;
	/** false: never fought, drawn as a dark "?" silhouette with "???" */
	met: boolean;
	kills: number;
	deaths: number;
	bestMs: number | null;
	tiers: readonly BestiaryTier[];
	claimed: number;
	/** The levels the +/- control walks through */
	levels: { min: number; max: number };
	stats: (level: number) => [string, string][];
	drops: (level: number) => BestiaryDropRow[];
}

export interface BestiaryBiomeGoal {
	biome: string;
	label: string;
	monsters: number;
	/** Goal tiers reached by the kills / already claimed */
	reached: number;
	claimed: number;
	/** Names of the monsters that hold the next tier back */
	missing: readonly string[];
	tiers: readonly { text: string; gems: number }[];
}

export interface BestiaryPanelProps {
	entries: readonly BestiaryEntry[];
	biomes: readonly BestiaryBiomeGoal[];
	/** "Mastery bonuses active" line, already worded by the caller */
	activeText: string;
	/** A claim is in flight: the buttons wait */
	busy?: boolean;
	onClaim?: (id: string, tier: number) => void;
	onClaimBiome?: (biome: string, tier: number) => void;
	onClaimAll?: () => void;
	/** Start with this monster selected */
	initial?: string;
}

const tierOf = (e: Pick<BestiaryEntry, 'tiers' | 'kills'>): number => e.tiers.filter((t) => e.kills >= t.kills).length;
const waitingOf = (e: BestiaryEntry): number => (e.met ? Math.max(0, tierOf(e) - e.claimed) : 0);
const TAG_COLOR: Record<string, string> = {
	Boss: '#8a2018',
	Elite: '#8a2018',
	Poison: '#2f6a1c',
	Magic: '#4d2490',
	Fire: '#b2481a',
	Frost: '#2a6f9c',
	Water: '#1f5f8a',
	Night: '#2d2a55',
	Armored: '#5a5a66',
	Fast: '#8a6a00',
	Pack: '#6a3f00',
	Passive: '#4a6a4a',
};
const FILTERS: [string, string][] = [
	['all', 'All'],
	['found', 'Discovered'],
	['new', 'Near tier'],
	['ready', 'Ready'],
	['boss', 'Bosses'],
];
const SILHOUETTE = '/pixel/enemies/placeholder/silhouette.png';

const timeText = (ms: number | null): string =>
	ms === null ? '-' : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;

/** One monster card: level tag, art, mastery gems and the kills toward the next tier. */
const Card: React.FC<{ e: BestiaryEntry; active: boolean; onPick: () => void }> = ({ e, active, onPick }) => {
	const t = tierOf(e);
	const full = t >= e.tiers.length;
	return (
		<button type='button' className='ds-mon' data-active={active} data-unk={!e.met} onClick={onPick} title={e.met ? e.name : 'Not met yet'}>
			<span className='ds-mon-lv'>{e.boss ? 'Boss' : `Lv ${e.levels.min}`}</span>
			{waitingOf(e) > 0 ? <span className='ds-mon-ready' title='Reward ready' /> : null}
			<span className='ds-mon-art'>
				<img src={e.met ? e.icon : SILHOUETTE} alt='' />
				{!e.met ? <b className='ds-mon-q'>?</b> : null}
			</span>
			<span className='ds-mon-name'>{e.met ? e.name : '???'}</span>
			<DiamondLevel level={e.met ? e.claimed : 0} max={e.tiers.length} />
			<span className='ds-dim ds-mon-k'>{!e.met ? 'Not met' : full ? `${compact(e.kills)} · max` : `${compact(e.kills)} / ${compact(e.tiers[t].kills)}`}</span>
		</button>
	);
};

const Detail: React.FC<{ e: BestiaryEntry; busy?: boolean; onClaim?: (id: string, tier: number) => void }> = ({ e, busy, onClaim }) => {
	const [level, setLevel] = useState(e.levels.min);
	const lv = Math.min(e.levels.max, Math.max(e.levels.min, level));
	const reached = tierOf(e);
	const unk = !e.met;
	const nextKills = e.tiers[Math.min(reached, e.tiers.length - 1)].kills;
	const statsOpen = e.met && e.claimed >= (e.tiers.findIndex((t) => t.reveal === 'stats') + 1 || 1) && e.tiers.some((t) => t.reveal === 'stats');
	const dropsAt = e.tiers.findIndex((t) => t.reveal === 'drops') + 1;
	const dropsOpen = e.met && dropsAt > 0 && e.claimed >= dropsAt;
	const statsAt = e.tiers.findIndex((t) => t.reveal === 'stats') + 1;
	return (
		<Panel parchment className='ds-ledger ds-detail'>
			<div className='ds-detail-head'>
				<span className='ds-deed-icon ds-deed-icon-lg'>
					<img src={unk ? SILHOUETTE : e.icon} alt='' className={unk ? 'ds-unk-sil' : undefined} />
					{unk ? <b className='ds-mon-q'>?</b> : null}
				</span>
				<div>
					<div className='ds-paper-title'>{unk ? '???' : e.name}</div>
					<div className='ds-paper-sub'>{unk ? 'Not yet encountered' : `${e.family} · ${e.boss ? 'Boss' : 'Monster'} · ${e.biomeLabel}`}</div>
					{!unk ? (
						<div className='ds-tags'>
							{e.tags.map((l) => (
								<span key={l} style={{ background: TAG_COLOR[l] ?? '#6a3f00' }}>
									{l}
								</span>
							))}
						</div>
					) : null}
				</div>
			</div>
			<p className='ds-paper-text' style={{ fontStyle: 'italic' }}>
				{unk ? 'Fight it once and the Bestiary writes it down.' : e.lore}
			</p>
			{!unk ? <div className='ds-paper-sub'>{e.where}</div> : null}
			<div className='ds-recs'>
				<div>
					<small>Kills</small>
					<b>{unk ? '-' : compact(e.kills)}</b>
				</div>
				<div>
					<small>Deaths to it</small>
					<b>{unk ? '-' : e.deaths}</b>
				</div>
				<div>
					<small>Best time</small>
					<b>{unk ? '-' : timeText(e.bestMs)}</b>
				</div>
			</div>
			<div className='ds-capi' style={{ marginTop: 10 }}>
				Mastery · Tier {Math.min(reached + 1, e.tiers.length)} of {e.tiers.length}
			</div>
			{e.tiers.map((t, i) => {
				const status = i < e.claimed ? 'unlocked' : i < reached ? 'claim' : i === reached ? 'next' : 'locked';
				return (
					<div className='ds-mastery' key={t.kills} data-status={status}>
						<b>{compact(t.kills)} kills</b>
						<span>
							{unk && i > 0 ? '?' : t.text}
							{t.reveal === 'stats' ? ' · stats' : t.reveal === 'drops' ? ' · drop table' : ''}
							{t.gems > 0 ? ` · ${t.gems} gems` : ''}
						</span>
						{status === 'claim' ? (
							<Button tone='gold' size='sm' disabled={busy} onClick={() => onClaim?.(e.id, i + 1)}>
								Claim
							</Button>
						) : (
							<em>{status === 'unlocked' ? 'Unlocked' : status === 'next' ? 'Next' : 'Locked'}</em>
						)}
					</div>
				);
			})}
			<div style={{ marginTop: 6 }}>
				<ProgressBar value={Math.min(e.kills, nextKills)} max={nextKills} tone='gold' height={16} label={`${compact(e.kills)} / ${compact(nextKills)}`} />
			</div>
			<div className='ds-paper-cols' style={{ marginTop: 10 }}>
				<div>
					<div className='ds-capi ds-lv-row'>
						<span>Stats · Level {lv}</span>
						{statsOpen ? (
							<span className='ds-lv-ctl'>
								<button type='button' aria-label='Lower level' disabled={lv <= e.levels.min} onClick={() => setLevel(lv - 1)}>
									-
								</button>
								<button type='button' aria-label='Higher level' disabled={lv >= e.levels.max} onClick={() => setLevel(lv + 1)}>
									+
								</button>
							</span>
						) : null}
					</div>
					{statsOpen ? (
						e.stats(lv).map(([l, v]) => (
							<div className='ds-paper-row' key={l}>
								<span>{l}</span>
								<b style={{ color: INK }}>{v}</b>
							</div>
						))
					) : (
						<div className='ds-paper-row'>
							<span>{unk ? '?' : `Claim the ${compact(e.tiers[Math.max(0, statsAt - 1)].kills)}-kill tier to read the stats`}</span>
						</div>
					)}
					{statsOpen ? (
						<div className='ds-paper-sub' style={{ marginTop: 4 }}>
							Levels {e.levels.min} to {e.levels.max}: it grows while it stands on the map.
						</div>
					) : null}
				</div>
				<div>
					<div className='ds-capi'>
						{dropsOpen ? `Drops · Level ${lv}` : `Drops · ${dropsAt > 0 ? compact(e.tiers[dropsAt - 1].kills) : '?'} kills to reveal`}
					</div>
					{dropsOpen ? (
						e.drops(lv).map((d) => (
							<div className='ds-paper-row' key={d.label}>
								<span>{d.label}</span>
								<b style={{ color: d.tone === 'rare' ? '#1f4fa8' : d.tone === 'epic' ? '#4d2490' : d.tone === 'good' ? '#17561f' : INK }}>{d.value}</b>
							</div>
						))
					) : (
						<div className='ds-paper-row'>
							<span style={{ color: MUTED }}>?</span>
						</div>
					)}
				</div>
			</div>
		</Panel>
	);
};

/** The biome collection strips: one bar per biome toward the next goal tier (every monster of the biome, its boss included, at that tier) with its own Claim. */
const BiomeStrip: React.FC<{ goals: readonly BestiaryBiomeGoal[]; busy?: boolean; onClaimBiome?: (biome: string, tier: number) => void }> = ({
	goals,
	busy,
	onClaimBiome,
}) => (
	<div className='ds-bst-biomes'>
		{goals.map((g) => {
			const next = Math.min(g.reached + 1, g.tiers.length);
			const claimable = g.reached > g.claimed;
			const done = g.claimed >= g.tiers.length;
			return (
				<div className='ds-bst-biome' key={g.biome} data-ready={claimable} title={g.missing.length ? `Still missing: ${g.missing.join(', ')}` : undefined}>
					<div className='ds-bst-biome-head'>
						<b>{g.label}</b>
						<DiamondLevel level={g.claimed} max={g.tiers.length} small />
					</div>
					<div className='ds-dim ds-bst-biome-text'>
						{done ? 'Collection complete' : `Goal ${next}: ${g.tiers[next - 1].text}${g.tiers[next - 1].gems ? ` · ${g.tiers[next - 1].gems} gems` : ''}`}
					</div>
					{claimable ? (
						<Button tone='gold' size='sm' disabled={busy} onClick={() => onClaimBiome?.(g.biome, g.claimed + 1)}>
							Claim goal {g.claimed + 1}
						</Button>
					) : done ? null : (
						<span className='ds-dim ds-bst-biome-text'>
							{g.missing.length} of {g.monsters} still short
						</span>
					)}
				</div>
			);
		})}
	</div>
);

/**
 * The whole Bestiary body. Wrap it in a window (`GameWindow` in the game, `WindowShell` in Storybook); it fills the height it is given and re-flows by its own width: wide = grid and detail side by side, medium = a narrower grid, narrow = one column.
 */
export const BestiaryPanel: React.FC<BestiaryPanelProps> = ({ entries, biomes, activeText, busy, onClaim, onClaimBiome, onClaimAll, initial }) => {
	const [filter, setFilter] = useState('all');
	const [family, setFamily] = useState('all');
	const [showBiomes, setShowBiomes] = useState(false);
	const [sel, setSel] = useState(initial ?? entries.find((e) => e.met)?.id ?? entries[0]?.id);
	const families = useMemo(() => [...new Set(entries.map((e) => e.family))].sort(), [entries]);
	const found = entries.filter((e) => e.met).length;
	const ready = entries.reduce((n, e) => n + waitingOf(e), 0) + biomes.reduce((n, g) => n + Math.max(0, g.reached - g.claimed), 0);
	const cards = entries.filter((e) => {
		if (family !== 'all' && e.family !== family) return false;
		if (filter === 'found') return e.met;
		if (filter === 'new') return e.met && tierOf(e) < e.tiers.length && e.kills >= e.tiers[tierOf(e)].kills * 0.6;
		if (filter === 'ready') return waitingOf(e) > 0;
		if (filter === 'boss') return e.boss;
		return true;
	});
	const m = entries.find((e) => e.id === sel) ?? entries[0];
	if (!m) return null;
	return (
		<div className='ds-bst'>
			<div className='ds-sumbar ds-bst-bar'>
				<div className='ds-sum-progress'>
					<span className='ds-dim'>Entries discovered</span>
					<ProgressBar value={found} max={entries.length} tone='gold' label={`${found} / ${entries.length}`} height={16} />
				</div>
				<div className='ds-sum-cell ds-bst-active'>
					<span className='ds-dim'>Mastery bonuses active</span>
					<b className='ds-good'>{activeText}</b>
				</div>
				{ready > 0 ? (
					<div className='ds-sum-claim'>
						<span className='ds-dim'>Rewards ready</span>
						<Badge count={ready} />
						{onClaimAll ? (
							<Button tone='gold' size='sm' disabled={busy} onClick={onClaimAll}>
								Claim all
							</Button>
						) : null}
					</div>
				) : null}
				<div className='ds-filters'>
					{FILTERS.map(([id, label]) => (
						<button key={id} type='button' data-active={filter === id} onClick={() => setFilter(id)}>
							{label}
						</button>
					))}
					<select className='ds-bst-family' value={family} onChange={(ev) => setFamily(ev.target.value)} aria-label='Family'>
						<option value='all'>Any family</option>
						{families.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
					<button type='button' data-active={showBiomes} onClick={() => setShowBiomes(!showBiomes)}>
						Biome goals
					</button>
				</div>
			</div>
			{showBiomes ? <BiomeStrip goals={biomes} busy={busy} onClaimBiome={onClaimBiome} /> : null}
			<div className='ds-bst-body'>
				<Inset className='ds-mons'>
					{cards.length === 0 ? (
						<div className='ds-dim' style={{ padding: 12 }}>
							Nothing matches this filter.
						</div>
					) : null}
					{cards.map((e) => (
						<Card key={e.id} e={e} active={e.id === m.id} onPick={() => setSel(e.id)} />
					))}
				</Inset>
				<Detail key={m.id} e={m} busy={busy} onClaim={onClaim} />
			</div>
		</div>
	);
};
