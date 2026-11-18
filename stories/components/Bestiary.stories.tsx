/* eslint-disable @next/next/no-img-element -- a story shows plain art files */
import React, { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BestiaryPanel } from '../../packages/design-system/src/views/bestiary';
import { DsRoot, WindowShell } from '../../packages/design-system/src/components/primitives';
import { MASTERY_BIOMES, biomeRoster, masteryTiersOf } from '@/catalog/mastery';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import {
	activeTextOf,
	biomeGoalsOf,
	dropRowsOf,
	emptyInput,
	entriesOf,
	levelRangeOf,
	statRowsOf,
	whereOf,
	biomeLabelOf,
	type BestiaryInput,
} from '@/lib/bestiary/entries';
import { masteryReachedOf } from '@/lib/mastery';
import { MONSTERS } from '@/config/combatConfig';
import { monsterSpriteUrl } from '@/catalog/monsters';

// The Bestiary window and the Monster catalogue. The window runs on the real catalogs, ladders, bonuses and drop tables with sample progress; a Claim button works on the sample.
const meta = { title: 'Screens/Bestiary', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Sample progress: the plains are mastered, the forest half done, the rest barely started, the last two biomes not met. */
const sample = (): BestiaryInput => {
	const kills: Record<string, number> = {};
	const seen = new Set<string>();
	const claimed: Record<string, number> = {};
	MONSTER_CATALOG.filter((m) => m.enabled).forEach((m, i) => {
		const biome = m.biomes[0];
		if (biome === 'plains') kills[m.id] = m.grade === 'boss' ? 120 : 2600;
		else if (biome === 'forest') kills[m.id] = m.grade === 'boss' ? 6 : 140 + i;
		else if (['hills', 'swamp', 'tundra', 'coast', 'lake'].includes(biome)) kills[m.id] = (i * 37) % 60;
		else if (biome === 'jungle') kills[m.id] = i % 3 === 0 ? 4 : 0;
		if (kills[m.id]) seen.add(m.id);
		if (biome === 'plains') claimed[m.id] = 3;
		if (biome === 'forest') claimed[m.id] = 1;
	});
	return {
		loaded: true,
		seen,
		kills,
		claimed,
		biomeClaimed: { plains: 1 },
		deaths: { thistleBoar: 3, mossbackWolf: 1 },
		bestMs: { thistleBoar: 4200, mossbackWolf: 6100 },
	};
};

const Live: React.FC<{ start: BestiaryInput; width?: number; height?: number }> = ({ start, width = 1080, height = 700 }) => {
	const [input, setInput] = useState(start);
	const entries = useMemo(() => entriesOf(input), [input]);
	const biomes = useMemo(() => biomeGoalsOf(input), [input]);
	const claim = (id: string, tier: number) => setInput((s) => ({ ...s, claimed: { ...s.claimed, [id]: tier } }));
	const claimBiome = (biome: string, tier: number) => setInput((s) => ({ ...s, biomeClaimed: { ...s.biomeClaimed, [biome]: tier } }));
	const claimAll = () =>
		setInput((s) => {
			const claimed = { ...s.claimed };
			for (const [id, k] of Object.entries(s.kills)) claimed[id] = Math.max(claimed[id] ?? 0, masteryReachedOf(id, k));
			return { ...s, claimed };
		});
	return (
		<DsRoot style={{ padding: 24, background: '#0b1022', minHeight: '100vh', boxSizing: 'border-box' }}>
			<WindowShell title='Bestiary' width={width} height={height} minWidth={360} minHeight={320}>
				<BestiaryPanel entries={entries} biomes={biomes} activeText={activeTextOf(input)} onClaim={claim} onClaimBiome={claimBiome} onClaimAll={claimAll} />
			</WindowShell>
		</DsRoot>
	);
};

/** The window as the game draws it. Drag the bottom-right corner: the layout follows the window's own width. */
export const Window: Story = { render: () => <Live start={sample()} /> };

/** The same window at a narrow width (one column). */
export const Narrow: Story = { render: () => <Live start={sample()} width={440} height={720} /> };

/** A new account: every entry is a dark "?" silhouette until the first fight. */
export const NothingMet: Story = { render: () => <Live start={emptyInput()} /> };

const toneColor = (tone?: string) => (tone === 'rare' ? '#6aa0ff' : tone === 'epic' ? '#b98cff' : tone === 'good' ? '#7ad07a' : undefined);

const cell: React.CSSProperties = { padding: '3px 8px', verticalAlign: 'top', borderBottom: '1px solid #3a2f22', fontSize: 12 };

/** One monster at one level: art, lore, requirements, stats and the full drop table. */
const Row: React.FC<{ id: string; level: number }> = ({ id, level }) => {
	const m = MONSTER_CATALOG.find((x) => x.id === id)!;
	const lv = Math.max(levelRangeOf(id).min, level);
	const stats = statRowsOf(id, lv);
	const drops = dropRowsOf(id, lv);
	const tiers = masteryTiersOf(id);
	return (
		<tr>
			<td style={{ ...cell, width: 110, textAlign: 'center' }}>
				<img src={monsterSpriteUrl(m)} alt='' width={72} height={72} style={{ imageRendering: 'pixelated', background: '#0a0b10' }} />
				<div style={{ fontSize: 11, color: '#c9b78e', marginTop: 2 }}>{m.art ? 'real art' : 'stand-in art'}</div>
			</td>
			<td style={{ ...cell, minWidth: 220 }}>
				<b style={{ fontSize: 14 }}>{m.label}</b>
				<div style={{ color: '#c9b78e' }}>
					{m.family} · {m.grade === 'boss' ? 'Boss' : 'Monster'}
				</div>
				<div style={{ margin: '4px 0' }}>{m.tags.join(' · ')}</div>
				<i style={{ color: '#d8c9a4' }}>{m.lore}</i>
			</td>
			<td style={{ ...cell, minWidth: 200 }}>
				<div>{whereOf(id)}</div>
				<div style={{ color: '#c9b78e', marginTop: 4 }}>
					Spawns at level {MONSTERS[id as keyof typeof MONSTERS].spawnWindow.base}-{MONSTERS[id as keyof typeof MONSTERS].spawnWindow.cap}, grows to{' '}
					{levelRangeOf(id).max}
				</div>
				<div style={{ color: '#c9b78e', marginTop: 4 }}>Mastery tiers at {tiers.map((t) => t.kills).join(' / ')} kills</div>
			</td>
			<td style={{ ...cell, minWidth: 170 }}>
				{stats.map(([l, v]) => (
					<div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
						<span style={{ color: '#c9b78e' }}>{l}</span>
						<b>{v}</b>
					</div>
				))}
			</td>
			<td style={{ ...cell, minWidth: 260 }}>
				{drops.map((d) => (
					<div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
						<span>{d.label}</span>
						<b style={{ color: toneColor(d.tone) }}>{d.value}</b>
					</div>
				))}
			</td>
		</tr>
	);
};

const Catalogue: React.FC = () => {
	const [level, setLevel] = useState(1);
	const [family, setFamily] = useState('all');
	const families = [...new Set(MONSTER_CATALOG.filter((m) => m.enabled).map((m) => m.family))].sort();
	return (
		<DsRoot style={{ padding: 24, background: '#14110f', minHeight: '100vh', boxSizing: 'border-box', color: '#f0e6cf' }}>
			<h1 style={{ margin: '0 0 6px' }}>Monster catalogue</h1>
			<p style={{ maxWidth: 820, color: '#c9b78e' }}>
				Every live monster, generated from the catalogs: art, family, tags, lore, where and when it appears, its stats at the chosen level (level 1 by default,
				bounded below by its spawn level) and the full drop table at that level. Gold and XP are caps; the real payout follows your income. Ingredients are junk
				materials today and crafting sub-ingredients later.
			</p>
			<label style={{ marginRight: 16 }}>
				Level{' '}
				<input
					type='number'
					min={1}
					max={80}
					value={level}
					onChange={(e) => setLevel(Math.max(1, Math.min(80, Number(e.target.value) || 1)))}
					style={{ width: 64 }}
				/>
			</label>
			<label>
				Family{' '}
				<select value={family} onChange={(e) => setFamily(e.target.value)}>
					<option value='all'>All</option>
					{families.map((f) => (
						<option key={f}>{f}</option>
					))}
				</select>
			</label>
			{MASTERY_BIOMES.map((biome) => {
				const ids = biomeRoster(biome).filter((id) => family === 'all' || MONSTER_CATALOG.find((m) => m.id === id)?.family === family);
				if (ids.length === 0) return null;
				return (
					<section key={biome} style={{ marginTop: 22 }}>
						<h2 style={{ margin: '0 0 6px' }}>
							{biomeLabelOf(biome)} <small style={{ color: '#c9b78e', fontWeight: 400 }}>{biomeRoster(biome).length} monsters</small>
						</h2>
						<div style={{ overflowX: 'auto' }}>
							<table style={{ borderCollapse: 'collapse', width: '100%' }}>
								<thead>
									<tr style={{ textAlign: 'left', color: '#c9b78e', fontSize: 11 }}>
										<th style={cell}>Art</th>
										<th style={cell}>Monster</th>
										<th style={cell}>Appears</th>
										<th style={cell}>Stats at level {level}</th>
										<th style={cell}>Drops at level {level}</th>
									</tr>
								</thead>
								<tbody>
									{ids.map((id) => (
										<Row key={id} id={id} level={level} />
									))}
								</tbody>
							</table>
						</div>
					</section>
				);
			})}
		</DsRoot>
	);
};

/** The human-readable catalogue: every monster with art, stats, lore, requirements and the drop table. Set the level to see the scaling. */
export const MonsterCatalogue: Story = { render: () => <Catalogue /> };
