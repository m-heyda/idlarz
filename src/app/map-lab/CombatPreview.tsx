'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BIOMES } from '@/config/gameConfig';
import { biomeColor } from '@/config/biomePalette';
import { MONSTER_CATALOG, monsterArtUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import { useLabStore } from '@/stores/labStore';

/** Same list as the lab's spawn dropdown: roster monsters with finished art that are not enabled yet */
export const WIP_MONSTERS = MONSTER_CATALOG.filter((m) => m.art && !m.enabled);

const HEROES = ['warrior', 'mage', 'ranger', 'paladin'] as const;

const btn = 'px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/15 text-xs';

/**
 * Map lab only: a big stand-in for the combat window's stage, to judge a monster's art at fight size. The hero stands on the left,
 * the monster on the right and (by default) flipped to face the hero. Nothing here talks to the game or the server.
 */
const CombatPreview: React.FC<{ initialId: string; onClose: () => void }> = ({ initialId, onClose }) => {
	const level = useLabStore((s) => s.monsterLevel);
	const lucky = useLabStore((s) => s.lucky);
	const [id, setId] = useState(initialId);
	const [flip, setFlip] = useState(true);
	const [hero, setHero] = useState<(typeof HEROES)[number]>('warrior');
	const [size, setSize] = useState(220);
	const [attacking, setAttacking] = useState(true);
	const entry = WIP_MONSTERS.find((m) => m.id === id) ?? WIP_MONSTERS[0];
	const ground = biomeColor(entry.biomes[0]);
	const boss = entry.grade === 'boss';
	const stageSize = boss ? Math.round(size * 1.35) : size;

	// a portal: the panel's backdrop blur would otherwise make it the box this overlay is fixed to
	return createPortal(
		<div className='fixed inset-0 z-[60] flex flex-col bg-black/85 text-white' role='dialog' aria-label='Combat preview'>
			<style>{`
				@keyframes cp-lunge { 0%, 70%, 100% { transform: translateX(0); } 80% { transform: translateX(40px); } }
				@keyframes cp-hit { 0%, 78%, 100% { filter: none; } 82% { filter: brightness(2.2) saturate(0.3); transform: translateX(8px) scale(0.96); } }
				@keyframes cp-bob { to { translate: 0 -4px; } }
				.cp-hero[data-on='true'] { animation: cp-lunge 1.6s steps(8) infinite; }
				.cp-monster[data-on='true'] { animation: cp-hit 1.6s steps(8) infinite; }
				.cp-monster-img { animation: cp-bob 0.9s steps(2) infinite alternate; }
			`}</style>
			<header className='flex flex-wrap items-center gap-3 border-b border-white/15 p-3 text-xs'>
				<b className='text-sm'>Combat preview</b>
				<select value={entry.id} onChange={(e) => setId(e.target.value)} className='rounded bg-white/10 px-1 py-1'>
					{WIP_MONSTERS.map((m) => (
						<option key={m.id} value={m.id} className='text-black'>
							{BIOMES[m.biomes[0] as string]?.label ?? m.biomes[0]}: {m.grade === 'boss' ? '☠ ' : ''}
							{m.label}
						</option>
					))}
				</select>
				<label className='flex items-center gap-1'>
					<input type='checkbox' checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Face left
				</label>
				<label className='flex items-center gap-1'>
					<input type='checkbox' checked={attacking} onChange={(e) => setAttacking(e.target.checked)} /> Swing / hit flash
				</label>
				<label className='flex items-center gap-1'>
					Hero
					<select value={hero} onChange={(e) => setHero(e.target.value as (typeof HEROES)[number])} className='rounded bg-white/10 px-1 py-0.5'>
						{HEROES.map((h) => (
							<option key={h} value={h} className='text-black'>
								{h}
							</option>
						))}
					</select>
				</label>
				<label className='flex items-center gap-1'>
					Monster size {size}px
					<input type='range' min={64} max={480} step={16} value={size} onChange={(e) => setSize(Number(e.target.value))} />
				</label>
				<button className={btn} onClick={() => setSize(monsterArtSize(entry.id, entry.grade) * 4)} title='The map size from config/monsterArtSize.ts, times 4'>
					Map size x4
				</button>
				<button className={`${btn} ml-auto`} onClick={onClose}>
					Close
				</button>
			</header>

			<div className='relative flex-1 overflow-hidden' style={{ background: `linear-gradient(#10141c 0%, #1d2430 55%, ${ground} 55%, #000 130%)` }}>
				<div className='absolute inset-x-0 top-3 text-center text-sm font-bold'>
					{boss ? '☠ ' : ''}
					{lucky ? '★ ' : ''}
					{entry.label} - Lv {level}
				</div>
				<div className='absolute inset-x-0 flex items-end justify-center gap-[12vw]' style={{ bottom: '40%' }}>
					<img
						className='cp-hero [image-rendering:pixelated]'
						data-on={attacking}
						src={`/pixel/icons/hero_${hero}.png`}
						alt='Hero'
						draggable={false}
						style={{ width: 56 * 4, height: 80 * 4, filter: 'drop-shadow(0 6px 0 rgba(0,0,0,.5))' }}
					/>
					<span className='cp-monster' data-on={attacking} style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined }}>
						<img
							className='cp-monster-img [image-rendering:pixelated]'
							src={monsterArtUrl(entry)}
							alt={entry.label}
							draggable={false}
							style={{ width: stageSize, height: stageSize, objectFit: 'contain', filter: `drop-shadow(0 6px 0 rgba(0,0,0,.5))${lucky ? ' sepia(1) saturate(4) hue-rotate(-10deg)' : ''}` }}
						/>
					</span>
				</div>
				<div className='absolute bottom-4 left-1/2 w-[min(640px,90vw)] -translate-x-1/2 space-y-1.5 text-[11px]'>
					{[
						['Monster', '#c0392b'],
						['You', '#3fa34d'],
					].map(([label, color]) => (
						<div key={label} className='relative h-5 border border-black bg-black/60'>
							<i className='absolute inset-y-0 left-0' style={{ width: '70%', background: color }} />
							<span className='absolute inset-0 flex items-center justify-center font-bold'>{label}</span>
						</div>
					))}
				</div>
			</div>
		</div>,
		document.body
	);
};

export default CombatPreview;
