'use client';

import React, { useEffect, useState } from 'react';
import { BIOMES } from '@/config/biomes';
import { labMonsters } from '@/catalog/monsters';
import { hitNumberText } from '@/lib/combatFx';
import { slashFor, SLASH_SHEETS, type SlashFx } from '@/config/slashFx';
import CombatPanel, { type FloatNumber } from '@/components/game/overlays/CombatPanel';
import { MONSTERS } from '@/config/combatConfig';
import { monsterStats } from '@/lib/monsters';
import type { MonsterType } from '@/types/game';
import { useLabStore } from '@/stores/labStore';
import type { FightView } from '@/lib/offline/fightTypes';

/** Same list as the lab's spawn dropdown (catalog/monsters.ts `labMonsters`): never empty */
export const WIP_MONSTERS = labMonsters();

const noop = () => {};

/**
 * Map lab only: the game's own combat window (CombatPanel) in its real spot, bottom right above the minimap, fed a mock fight.
 * The monster is mirrored to face left by default. Nothing here talks to the game or the server.
 */
const CombatPreview: React.FC = () => {
	const level = useLabStore((s) => s.monsterLevel);
	const id = useLabStore((s) => s.combatPreview);
	const setId = useLabStore((s) => s.setCombatPreview);
	const [flip, setFlip] = useState(true);
	const [swinging, setSwinging] = useState(true);
	const [tick, setTick] = useState(0);
	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const [slashes, setSlashes] = useState<SlashFx[]>([]);
	const entry = WIP_MONSTERS.find((m) => m.id === id) ?? WIP_MONSTERS[0];

	// the real window is driven by the server's hits; here a hit lands every 1.6 s so the flash and the numbers can be seen
	useEffect(() => {
		if (!swinging) return;
		const timer = setInterval(() => {
			setTick((t) => t + 1);
			const nid = Date.now();
			const roll = Math.random();
			const crit = roll > 0.9 ? 'super' : roll > 0.65 ? 'crit' : 'none'; // the lab shows all three looks of a hit
			setNumbers((prev) => [
				...prev.slice(-4),
				{
					id: nid,
					text: hitNumberText(Math.round(40 + Math.random() * 60) * (crit === 'none' ? 1 : crit === 'crit' ? 2 : 5), crit),
					kind: crit === 'none' ? 'dmg' : crit,
					x: 20 + Math.random() * 60,
				},
			]);
			setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== nid)), 900);
			const name = slashFor(crit === 'none' ? 'hit' : crit, nid);
			setSlashes((prev) => [...prev.slice(-3), { id: nid, name, onHero: false, mirror: nid % 2 === 0 }]);
			setTimeout(() => setSlashes((prev) => prev.filter((s) => s.id !== nid)), SLASH_SHEETS[name].ms + 40);
		}, 1600);
		return () => clearInterval(timer);
	}, [swinging]);

	const type: MonsterType = (entry.id in MONSTERS ? entry.id : 'thistleBoar') as MonsterType;
	const stats = monsterStats(type, level);
	const fight: FightView = {
		n: 1,
		type,
		level,
		lucky: false,
		monsterHp: stats.maxHp * 0.65,
		monsterMaxHp: stats.maxHp,
		stunLeft: 0,
		timeLeftSec: entry.grade === 'boss' ? 42 : null,
		x: 0,
		y: 0,
	};

	return (
		<div className='flex flex-col items-end gap-1'>
			<div className='pointer-events-auto flex items-center gap-2 rounded border border-white/15 bg-black/70 px-2 py-1 text-[11px] text-white backdrop-blur'>
				<select value={entry.id} onChange={(e) => setId(e.target.value)} className='max-w-[150px] rounded bg-white/10 px-1 py-0.5'>
					{WIP_MONSTERS.map((m) => (
						<option key={m.id} value={m.id} className='text-black'>
							{BIOMES[m.biomes[0] as string]?.label ?? m.biomes[0]}: {m.grade === 'boss' ? '☠ ' : ''}
							{m.label}
						</option>
					))}
				</select>
				<label className='flex items-center gap-1'>
					<input type='checkbox' checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Left
				</label>
				<label className='flex items-center gap-1'>
					<input type='checkbox' checked={swinging} onChange={(e) => setSwinging(e.target.checked)} /> Hits
				</label>
			</div>
			<CombatPanel
				monster={{ type, level, art: entry.id }}
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
				slashes={slashes}
				hitTick={tick}
				shake={false}
				onFlee={() => setId(null)}
				onCloseResult={noop}
				onMinimize={() => setId(null)}
				onAutoBattle={noop}
				onAutoUse={noop}
			/>
		</div>
	);
};

export default CombatPreview;
