import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { COMBAT } from '@/config/combatConfig';
import { SKILLS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { MONSTER_CATALOG, monsterArtUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import { monsterDef, monsterStats } from '@/lib/monsters';
import type { Cooldowns, FightView } from '@/lib/offline/fightTypes';
import type { BagSlot, CombatNotice, MonsterType } from '@/types/game';
import MonsterArt from '../MonsterArt';
import ItemSlot from '../ItemSlot';
import ResourceIcon from '../ResourceIcon';
import { slotProps } from '../itemUi';
import '@/styles/Fight.css';
import '@/styles/CombatWidget.css';

export interface FloatNumber {
	id: number;
	text: string;
	kind: 'dmg' | 'crit' | 'super' | 'hurt' | 'heal' | 'stun' | 'resist';
	x: number;
}

/** How long a bar takes to run to a new number: about the time since the last answer, which is when the next one comes (null: no run, it jumps). */
export const drainMs = (sinceLastAnswerMs: number): number | null => (sinceLastAnswerMs > 6000 ? null : Math.max(350, Math.min(2600, sinceLastAnswerMs)));

/**
 * A bar that drains smoothly. The server answers every couple of seconds with where the fight stands, so the number jumps; the bar
 * instead runs from where it is to the new number over about the time since the last answer (the next one arrives around then), which
 * makes the HP of both sides move continuously. `snapKey` changes with a new fight: the bar starts at once from its first number.
 * It paints itself (no re-render per frame).
 */
const Bar: React.FC<{ value: number; max: number; kind: 'monster' | 'player' | 'mana'; label: string; snapKey?: unknown }> = ({ value, max, kind, label, snapKey }) => {
	const fillRef = useRef<HTMLDivElement>(null);
	const trailRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const shown = useRef(value);
	const maxRef = useRef(max);
	const lastChange = useRef(0);
	const lastKey = useRef<unknown>(undefined);
	const frame = useRef(0);

	const paint = useCallback(
		(v: number) => {
			shown.current = v;
			const pct = maxRef.current > 0 ? Math.max(0, Math.min(100, (v / maxRef.current) * 100)) : 0;
			if (fillRef.current) fillRef.current.style.width = `${pct}%`;
			if (trailRef.current) trailRef.current.style.width = `${pct}%`;
			if (textRef.current) textRef.current.textContent = `${label} ${formatCompact(Math.ceil(v))} / ${formatCompact(Math.round(maxRef.current))}`;
		},
		[label]
	);

	useLayoutEffect(() => {
		maxRef.current = max;
		cancelAnimationFrame(frame.current);
		const now = performance.now();
		const first = lastKey.current === undefined || lastKey.current !== snapKey;
		const duration = drainMs(now - lastChange.current);
		lastKey.current = snapKey;
		lastChange.current = now;
		// a new fight, a first number, or a jump after a long silence: no animation
		if (first || duration === null || Math.abs(value - shown.current) < 1e-9) {
			paint(value);
			return;
		}
		const from = shown.current;
		const start = now;
		const step = (time: number) => {
			const k = Math.min(1, (time - start) / duration);
			paint(from + (value - from) * k);
			if (k < 1) frame.current = requestAnimationFrame(step);
		};
		frame.current = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame.current);
	}, [value, max, snapKey, paint]);

	return (
		<div className='fight-bar' data-kind={kind} aria-label={label}>
			<div ref={trailRef} className='fight-bar-trail' />
			<div ref={fillRef} className='fight-bar-fill' style={{ transition: 'none' }} />
			<div ref={textRef} className='fight-bar-text' />
		</div>
	);
};

/** What a fight left behind, under the monster on the stage (dead, with a red cross, after a win): the gold, XP and hide, the drops (hover for the item card). */
const FightResult: React.FC<{ notice: CombatNotice }> = ({ notice }) => {
	const def = monsterDef(notice.type);
	const { summary } = notice;
	const won = notice.kind === 'won' && summary;
	return (
		<div className='fight-reward'>
			{won ? (
				<>
					<div className='victory-title'>{def.label} defeated</div>
					<div className='victory-row'>
						<span className='flex items-center gap-1'>
							+{formatNumber(Math.floor(summary.gold))} <ResourceIcon resource='gold' />
						</span>
						<span className='flex items-center gap-1'>
							+{formatNumber(Math.floor(summary.xp))} <ResourceIcon resource='xp' />
						</span>
						{(summary.hide ?? 0) > 0 && (
							<span className='flex items-center gap-1'>
								+{formatNumber(Math.floor(summary.hide ?? 0))} <ResourceIcon resource='hide' />
							</span>
						)}
					</div>
					{summary.items.length > 0 ? (
						<div className='victory-loot'>{summary.items.map((drop, i) => (drop.kind === 'gear' ? <ItemSlot key={i} item={drop.item} /> : <ItemSlot key={i} itemId={drop.id} qty={drop.qty} />))}</div>
					) : (
						<div className='victory-note'>No drops this time</div>
					)}
					{summary.lucky && <div className='victory-note text-yellow-300'>Lucky monster! x3 gold and XP and an extra piece of gear roll</div>}
					{summary.autoSold.count > 0 && (
						<div className='victory-note'>
							Auto-sold {summary.autoSold.count} piece{summary.autoSold.count === 1 ? '' : 's'} of gear for {formatNumber(summary.autoSold.gold)} gold
						</div>
					)}
					{summary.convertedGold > 0 && <div className='victory-note'>Bag full - {formatNumber(summary.convertedGold)} gold paid for the drops that did not fit</div>}
				</>
			) : (
				<>
					<div className='victory-title'>{notice.kind === 'defeated' ? `Knocked out by the ${def.label}` : `Time ran out against the ${def.label}`}</div>
					{notice.taunt && <div className='victory-note italic'>&ldquo;{notice.taunt}&rdquo;</div>}
					<div className='victory-note'>The monster stays where it is.</div>
				</>
			)}
		</div>
	);
};

/** On the fight stage a roster picture is drawn this many times its map size, so it fits the compact window (the rats' sheets are drawn at scale 4 / 3) */
const STAGE_ART_FACTOR = 2.6;

export interface CombatPanelProps {
	/** The monster the window is about; `art` (a roster id, map lab / future monsters) draws its still picture instead of the rat sheet */
	monster: { type: MonsterType; level: number; art?: string };
	/** Draw the monster mirrored, so it faces left toward the hero */
	flip?: boolean;
	/** The open fight (timer and stun), when there is one */
	fight: FightView | null;
	/** A click is waiting for the server: the stage says "Engaging..." */
	loading: boolean;
	/** The result shown in place of the fight (a won fight draws the monster dead) */
	over: CombatNotice | null;
	monsterHp: number;
	monsterMaxHp: number;
	/** Changes with a new fight so the bars start at once from their first number */
	snapKey: unknown;
	player: { hp: number; maxHp: number; mp: number; maxMp: number; level: number };
	cd: Cooldowns;
	/** Up to three potion stacks (hotkeys 1-3) */
	potions: { slot: BagSlot }[];
	autoBattle: boolean;
	autoLocked: boolean;
	autoUse: boolean;
	/** The server's reason Auto-battle is idle, when it is */
	autoNote?: string | null;
	numbers: FloatNumber[];
	hitTick: number;
	shake: boolean;
	onFlee: () => void;
	onCloseResult: () => void;
	onMinimize: () => void;
	onAutoBattle: (on: boolean) => void;
	onAutoUse: (on: boolean) => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
}

/**
 * The combat window as pure view: everything it shows comes in by props. The game's CombatWidget feeds it the real fight; the map lab
 * (/map-lab, Combat preview) feeds it a mock one, so the art is judged in the very window the player sees.
 */
const CombatPanel: React.FC<CombatPanelProps> = (p) => {
	const { monster, flip, fight, over, player, cd } = p;
	const def = monsterDef(monster.type);
	const wip = monster.art ? MONSTER_CATALOG.find((m) => m.id === monster.art) : undefined;
	const label = wip?.label ?? def.label;
	const boss = wip ? wip.grade === 'boss' : def.grade === 'boss';
	const traits = monsterStats(monster.type, monster.level);
	const dead = over?.kind === 'won';
	const hpKey = dead ? 'dead' : p.hitTick;

	/** The hotkey slots and the potions (a fight only), and the two switches */
	const controls = (switchesOnly: boolean) => (
		<>
			{!switchesOnly && (
				<>
					{/* Hotkey slots: they show what is ready, they are not buttons */}
					<div className='fight-skills'>
						{SKILL_IDS.map((id, i) => {
							const skill = SKILLS[id];
							const locked = player.level < skill.unlockLevel;
							const left = cd[id];
							return (
								<div
									key={id}
									className='fight-skill'
									data-locked={locked}
									data-nomana={!locked && player.mp < skill.manaCost}
									title={`${skill.name}: ${skillDescription(skill)} (${locked ? `unlocks at level ${skill.unlockLevel}` : `${skill.manaCost} mana, ${skill.cooldownSec} s cooldown`}). Press ${4 + i}.`}>
									<span className='fight-skill-name'>{skill.name}</span>
									<span className='fight-skill-cost'>{locked ? `Lv ${skill.unlockLevel}` : `${skill.manaCost} MP`}</span>
									<span className='fight-hotkey'>{4 + i}</span>
									{!locked && left > 0 && <span className='fight-cooldown' style={{ height: `${Math.min(100, (left / skill.cooldownSec) * 100)}%` }} />}
								</div>
							);
						})}
					</div>
					<div className='fight-potions'>
						{p.potions.length === 0 && <span className='px-tip-muted text-xs'>No potions</span>}
						{p.potions.map(({ slot }, i) => (
							<div key={i} className='fight-potion' title={`Press ${i + 1} to drink`}>
								<ItemSlot {...slotProps(slot)} />
								<span className='fight-hotkey'>{i + 1}</span>
								{cd.potion > 0 && <span className='fight-cooldown' style={{ height: `${Math.min(100, (cd.potion / COMBAT.potionCooldownSec) * 100)}%` }} />}
							</div>
						))}
					</div>
				</>
			)}
			<div className='combat-switches'>
				<label
					title={p.autoLocked ? 'Unlocks after your first rebirth' : 'After a fight the server sends you against the next monster, one at a time. Off: click a monster to fight it'}
					data-locked={p.autoLocked}>
					<input type='checkbox' checked={p.autoBattle && !p.autoLocked} disabled={p.autoLocked} onChange={(e) => p.onAutoBattle(e.target.checked)} /> Auto-battle
				</label>
				{p.autoBattle && !fight && p.autoNote === 'no_winnable' && (
					<span className='px-tip-muted text-xs' title='Click a monster to fight it anyway'>
						Waiting: no monster looks winnable
					</span>
				)}
				<label title={`Drinks a potion below ${COMBAT.auto.potionBelowHpPct}% HP, casts Heal below ${COMBAT.auto.healBelowHpPct}%, Stun when ready`}>
					<input type='checkbox' checked={p.autoUse} onChange={(e) => p.onAutoUse(e.target.checked)} /> Auto-use
				</label>
			</div>
		</>
	);

	// the monster's picture on the stage: the rat sheets at their usual scale, a roster picture sized from the map size
	const art = wip ? (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={monsterArtUrl(wip)}
			alt={wip.label}
			draggable={false}
			style={{ width: monsterArtSize(wip.id, wip.grade) * STAGE_ART_FACTOR, height: monsterArtSize(wip.id, wip.grade) * STAGE_ART_FACTOR, objectFit: 'contain', imageRendering: 'pixelated' }}
		/>
	) : (
		<MonsterArt type={monster.type} scale={monster.type === 'ratKing' ? 3 : 4} />
	);

	return (
		<section className='combat-widget px-card' aria-label='Combat' onMouseEnter={p.onMouseEnter} onMouseLeave={p.onMouseLeave}>
			<header className='combat-head'>
				<b>{`${boss ? '☠ ' : ''}${label} - Lv ${monster.level}`}</b>
				<span className='flex gap-1'>
					{fight && (
						<button className='combat-flee' onClick={p.onFlee} aria-label='Flee from the fight' title='Leave the fight: no reward, no penalty, the monster stays. Switches Auto-battle off'>
							Flee
						</button>
					)}
					{over && (
						<button className='combat-min' onClick={p.onCloseResult} aria-label='Close the result' title='Close'>
							x
						</button>
					)}
					<button className='combat-min' onClick={p.onMinimize} aria-label='Minimize the combat panel' title='Minimize'>
						_
					</button>
				</span>
			</header>
			<div className='fight-body' data-shake={p.shake && !over}>
				<div className='fight-hurt-flash' data-on={p.shake && !over} aria-hidden />
				{boss && (
					<div className='fight-boss' title='A boss: its own drops, crits and sometimes resists Stun'>
						<b>BOSS</b>
						<span className='fight-boss-traits'>
							Crits {formatCompact(traits.critChance)}% - resists Stun {formatCompact(traits.stunResist)}% - armor {formatCompact(Math.round(traits.armor))}
						</span>
					</div>
				)}
				{fight && fight.timeLeftSec !== null && (
					<div className='fight-timer' data-low={fight.timeLeftSec <= 10}>
						Time left: {Math.ceil(fight.timeLeftSec)} s
					</div>
				)}
				<div className='combat-stage'>
					<span key={hpKey} className='fight-sprite' data-hit={!over && p.hitTick > 0} data-loading={p.loading}>
						<span className={dead ? 'fight-dead' : undefined} style={flip ? { display: 'block', transform: 'scaleX(-1)' } : undefined}>
							{art}
						</span>
					</span>
					{p.loading && <div className='fight-loading'>Engaging...</div>}
					{fight && fight.stunLeft > 0 && <div className='fight-stunned'>Stunned {fight.stunLeft.toFixed(1)} s</div>}
					{p.numbers.map((n) => (
						<span key={n.id} className='fight-number' data-kind={n.kind} style={{ left: `${n.x}%` }}>
							{n.text}
						</span>
					))}
				</div>
				{over && <FightResult notice={over} />}
				<Bar value={p.monsterHp} max={p.monsterMaxHp} kind='monster' label={label} snapKey={p.snapKey} />
				<Bar value={player.hp} max={player.maxHp} kind='player' label='You' snapKey={p.snapKey} />
				<Bar value={player.mp} max={player.maxMp} kind='mana' label='Mana' snapKey={p.snapKey} />
				{controls(!!over)}
			</div>
		</section>
	);
};

export default CombatPanel;
