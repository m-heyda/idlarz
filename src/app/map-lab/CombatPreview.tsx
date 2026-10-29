'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BIOMES } from '@/config/gameConfig';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import CombatPanel, { type FloatNumber } from '@/components/game/overlays/CombatPanel';
import { monsterStats } from '@/lib/monsters';
import { useLabStore } from '@/stores/labStore';
import type { FightView } from '@/lib/offline/fightTypes';

/** Same list as the lab's spawn dropdown: roster monsters with finished art that are not enabled yet */
export const WIP_MONSTERS = MONSTER_CATALOG.filter((m) => m.art && !m.enabled);

const btn = 'px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/15 text-xs';
const noop = () => {};

/**
 * Map lab only: the game's own combat window (CombatPanel), fed a mock fight, enlarged so the art can be judged on a big screen.
 * The monster is mirrored to face left by default. Nothing here talks to the game or the server.
 */
const CombatPreview: React.FC<{ initialId: string; onClose: () => void }> = ({ initialId, onClose }) => {
	const level = useLabStore((s) => s.monsterLevel);
	const [id, setId] = useState(initialId);
	const [flip, setFlip] = useState(true);
	const [zoom, setZoom] = useState(2);
	const [swinging, setSwinging] = useState(true);
	const [tick, setTick] = useState(0);
	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const entry = WIP_MONSTERS.find((m) => m.id === id) ?? WIP_MONSTERS[0];

	// the real window is driven by the server's hits; here a hit lands every 1.6 s so the flash, the numbers and the bob can be seen
	useEffect(() => {
		if (!swinging) return;
		const timer = setInterval(() => {
			setTick((t) => t + 1);
			const nid = Date.now();
			setNumbers((prev) => [...prev.slice(-4), { id: nid, text: `-${Math.round(40 + Math.random() * 60)}`, kind: 'dmg', x: 20 + Math.random() * 60 }]);
			setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== nid)), 900);
		}, 1600);
		return () => clearInterval(timer);
	}, [swinging]);

	const stats = monsterStats('rat', level);
	const fight: FightView = { n: 1, type: 'rat', level, lucky: false, monsterHp: stats.maxHp * 0.65, monsterMaxHp: stats.maxHp, stunLeft: 0, timeLeftSec: entry.grade === 'boss' ? 42 : null, x: 0, y: 0 };

	// a portal: the panel's backdrop blur would otherwise make it the box this overlay is fixed to
	return createPortal(
		<div className='fixed inset-0 z-[60] flex flex-col bg-black/85 text-white' role='dialog' aria-label='Combat preview'>
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
					<input type='checkbox' checked={swinging} onChange={(e) => setSwinging(e.target.checked)} /> Hit flash
				</label>
				<label className='flex items-center gap-1'>
					Zoom {zoom}x
					<input type='range' min={1} max={3} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
				</label>
				<button className={`${btn} ml-auto`} onClick={onClose}>
					Close
				</button>
			</header>
			<div className='flex flex-1 items-center justify-center overflow-auto p-6'>
				<div style={{ zoom }}>
					<CombatPanel
						monster={{ type: 'rat', level, art: entry.id }}
						flip={flip}
						fight={fight}
						loading={false}
						over={null}
						monsterHp={fight.monsterHp}
						monsterMaxHp={fight.monsterMaxHp}
						snapKey='lab'
						player={{ hp: 700, maxHp: 1000, mp: 60, maxMp: 100, level: 10 }}
						cd={{ heal: 0, stun: 0, potion: 0 }}
						potions={[]}
						autoBattle={false}
						autoLocked
						autoUse={false}
						numbers={numbers}
						hitTick={tick}
						shake={false}
						onFlee={noop}
						onCloseResult={noop}
						onMinimize={noop}
						onAutoBattle={noop}
						onAutoUse={noop}
					/>
				</div>
			</div>
		</div>,
		document.body
	);
};

export default CombatPreview;
