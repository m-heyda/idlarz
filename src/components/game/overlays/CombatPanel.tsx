import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { monsterNameOf } from '@/stores/bestiaryStore';
import { formatCompact, formatNumber, tidy } from '@/utils/formatters';
import { formatRest } from '@/hooks/useRestCountdown';
import { COMBAT } from '@/config/combatConfig';
import { COMBAT_BACKGROUND_STYLE, combatBackgroundUrl } from '@/config/combatBackground';
import { SKILLS, SKILL_ICONS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { monsterSpriteUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import { SLASH_FRAME, SLASH_SHEETS, type SlashFx } from '@/config/slashFx';
import { winBucketOf, type WinBucket } from '@/lib/combat';
import { isBoss, monsterDef, monsterStats } from '@/lib/monsters';
import type { Cooldowns, FightView } from '@/lib/offline/fightTypes';
import type { BagSlot, CombatNotice, MonsterType } from '@/types/game';
import MonsterArt, { labPreviewOf } from '../MonsterArt';
import ItemSlot from '../ItemSlot';
import { Checkbox, HoverTip } from '../../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../../packages/design-system/src/components/tooltips';
import ResourceIcon from '../ResourceIcon';
import { slotProps } from '../itemUi';
import { describeModifiers } from '@/lib/bossModifiers';
import '@/styles/Fight.css';
import '@/styles/CombatWidget.css';

export interface FloatNumber {
	id: number;
	text: string;
	kind: 'dmg' | 'crit' | 'super' | 'hurt' | 'poison' | 'heal' | 'stun' | 'resist';
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
const Bar: React.FC<{ value: number; max: number; kind: 'monster' | 'player' | 'mana'; label: string; snapKey?: unknown }> = ({
	value,
	max,
	kind,
	label,
	snapKey,
}) => {
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
			if (textRef.current)
				textRef.current.textContent = `${label ? `${label} ` : ''}${formatCompact(Math.ceil(v))} / ${formatCompact(Math.round(maxRef.current))}`;
		},
		[label],
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

/** What a fight left behind, under the monster on the stage (dead: the monster in grey with a skull on it, after a win): the gold, XP and hide, the drops (hover for the item card). */
/** How a queued monster's win chance is shown in the Next strip: a shape and a word besides the colour, which the stylesheet gives by `data-win`. */
const WIN_BUCKETS: Record<WinBucket, { word: string; icon: string }> = {
	safe: { word: 'Safe', icon: '✔' },
	risky: { word: 'Risky', icon: '!' },
	unlikely: { word: 'Unlikely', icon: '✖' },
};

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
						<div className='victory-loot'>
							{summary.items.map((drop, i) =>
								drop.kind === 'gear' ? <ItemSlot key={i} item={drop.item} /> : <ItemSlot key={i} itemId={drop.id} qty={drop.qty} />,
							)}
						</div>
					) : (
						<div className='victory-note'>No drops this time</div>
					)}
					{summary.lucky && <div className='victory-note text-yellow-300'>Lucky monster! x3 gold and XP and an extra piece of gear roll</div>}
					{summary.autoSold.count > 0 && (
						<div className='victory-note'>
							Auto-sold {summary.autoSold.count} piece{summary.autoSold.count === 1 ? '' : 's'} of gear for {formatNumber(summary.autoSold.gold)} gold
						</div>
					)}
					{summary.convertedGold > 0 && (
						<div className='victory-note'>Bag full - {formatNumber(summary.convertedGold)} gold paid for the drops that did not fit</div>
					)}
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

/**
 * The battle queue as its own small window under the combat panel (dark glass over the game): the monsters waiting for their turn, each with picture, level, win chance
 * and a way to take it out. The header's toggle folds it to one row of small chips (picture and win mark only); it is not drawn while the queue is empty.
 *
 * @category Combat/Window
 */
const CombatQueue: React.FC<{
	queue?: CombatPanelProps['queue'];
	queueMax?: number;
	onUnqueue?: (n: number) => void;
	compact: boolean;
	onCompact: (compact: boolean) => void;
}> = ({ queue, queueMax, onUnqueue, compact, onCompact }) => {
	if (!queue || queue.length === 0) return null;
	return (
		<section className='ds-root combat-queue-window' data-compact={compact} aria-label={`Battle queue: ${queue.length} of ${queueMax ?? queue.length}`}>
			<header className='combat-queue-head'>
				<b title='Monsters waiting for their turn (the queue holds this many)'>
					Queue {queue.length}/{queueMax ?? queue.length}
				</b>
				<button
					type='button'
					className='combat-min'
					onClick={() => onCompact(!compact)}
					aria-expanded={!compact}
					aria-label={compact ? 'Show the full battle queue' : 'Show the battle queue compact'}
					title={compact ? 'Expand' : 'Compact'}
				>
					{compact ? '+' : '_'}
				</button>
			</header>
			<div className='fight-queue'>
				{queue.map((q, i) => {
					const bucket = q.winPct === undefined ? null : WIN_BUCKETS[winBucketOf(q.winPct)];
					return (
						<span
							key={q.n}
							className='fight-queue-item'
							data-boss={monsterDef(q.type).grade === 'boss'}
							data-lucky={!!q.lucky}
							data-win={bucket ? winBucketOf(q.winPct!) : undefined}
							title={`${i + 1}. ${q.lucky ? 'Lucky ' : ''}${monsterNameOf(q.type, monsterDef(q.type).label)}, level ${q.level}${bucket ? `, ${bucket.word}: ${q.winPct}% win chance` : ''}`}
						>
							<span className='fight-queue-art'>
								<MonsterArt type={q.type} scale={0.8} />
							</span>
							<i className='fight-queue-lv'>{formatCompact(q.level)}</i>
							{bucket && (
								<b className='fight-queue-win' aria-label={`${bucket.word}, ${q.winPct}% win chance`}>
									{bucket.icon}
								</b>
							)}
							{onUnqueue && (
								<button
									className='fight-queue-x'
									onClick={() => onUnqueue(q.n)}
									aria-label={`Take ${monsterNameOf(q.type, monsterDef(q.type).label)} out of the queue`}
									title='Take it out of the queue'
								>
									x
								</button>
							)}
						</span>
					);
				})}
			</div>
		</section>
	);
};

/** On the fight stage a roster picture is drawn this many times its map size, so it fits the compact window  */
const STAGE_ART_FACTOR = 2.6;

export interface CombatPanelProps {
	/** The monster the window is about; `art` (a roster id, the map lab) draws another roster monster's picture instead of its own */
	monster: { type: MonsterType; level: number; art?: string; lucky?: boolean };
	/** Draw the monster mirrored, so it faces left toward the hero */
	flip?: boolean;
	/** The biome the monster lives in: its landscape (config/combatBackground.ts) is drawn behind it; none, or one without a picture, keeps the plain stage */
	biome?: string;
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
	/** The potion stacks on the hotkey bar (keys 1..N, N = `potionSlots`) */
	potions: { slot: BagSlot }[];
	/** Potion stacks on the bar and the shared potion cooldown in seconds, both shaped by the belt (lib/potionBelt.ts); the base values when left out (the lab) */
	potionSlots?: number;
	potionCooldownSec?: number;
	autoBattle: boolean;
	autoLocked: boolean;
	autoUse: boolean;
	/** Auto-use is a reward for the first rebirth: its switch is not shown before */
	autoUseLocked: boolean;
	/** The server's reason Auto-battle is idle, when it is */
	autoNote?: string | null;
	numbers: FloatNumber[];
	/** Slash effects playing over the stage (blows landed and taken) */
	slashes?: SlashFx[];
	hitTick: number;
	shake: boolean;
	/** The monsters waiting for their turn (the battle queue) and a way to take one out; both left out in the lab */
	queue?: { n: number; type: MonsterType; level: number; lucky?: boolean; winPct?: number }[];
	queueMax?: number;
	onUnqueue?: (n: number) => void;
	/** The queue window is in its compact view (one row of small chips); left out, the panel keeps the choice itself (the lab) */
	queueCompact?: boolean;
	onQueueCompact?: (compact: boolean) => void;
	/** The hero rests before the queue's next fight: seconds left (counted down by the caller) and the next monster's name; left out in the lab */
	restSec?: number | null;
	restLabel?: string;
	/** A click on a skill slot or a potion slot does what its hotkey does (the server decides whether it goes through); left out in the lab */
	onSkill?: (id: (typeof SKILL_IDS)[number]) => void;
	onPotion?: (id: string) => void;
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
	const wip = labPreviewOf(monster.art);
	const label = wip?.label ?? def.label;
	const boss = wip ? wip.grade === 'boss' : def.grade === 'boss';
	const traits = monsterStats(monster.type, monster.level);
	const dead = over?.kind === 'won';
	const hpKey = dead ? 'dead' : p.hitTick;
	const bgUrl = combatBackgroundUrl(p.biome);
	/** The glide of the picture starts over with every new fight (the next monster from the queue, another target), never carrying the old position over; a result keeps the fight's key so the picture does not jump */
	const lastFightKey = useRef(String(p.snapKey));
	if (typeof p.snapKey === 'string' && p.snapKey.startsWith('fight-')) lastFightKey.current = p.snapKey;
	const sceneKey = `${lastFightKey.current}-${monster.type}-${p.biome ?? ''}`;
	const [localCompact, setLocalCompact] = useState(false);
	const compact = p.queueCompact ?? localCompact;
	const setCompact = p.onQueueCompact ?? setLocalCompact;

	/** The hotkey slots and the potions (a fight only), and the two switches */
	const controls = (switchesOnly: boolean) => (
		<>
			{!switchesOnly && (
				<>
					{/* The hotbar: the potions, then the skills as small icons (a click does what the key does; the details are in the tooltip, the cooldown runs over the icon like a potion's) */}
					<div className='fight-hotbar'>
						{p.potions.length === 0 && <span className='px-tip-muted text-xs'>No potions</span>}
						{p.potions.map(({ slot }, i) => (
							<button
								type='button'
								key={i}
								className='fight-potion'
								onClick={() => slot && 'id' in slot && p.onPotion?.(slot.id)}
								title={`Press ${i + 1} or click to drink`}
							>
								<ItemSlot {...slotProps(slot)} />
								<span className='fight-hotkey'>{i + 1}</span>
								{cd.potion > 0 && (
									<>
										<span
											className='fight-cooldown'
											style={{ height: `${Math.min(100, (cd.potion / (p.potionCooldownSec ?? COMBAT.potionCooldownSec)) * 100)}%` }}
										/>
										<b className='fight-cd-num'>{Math.ceil(cd.potion)}</b>
									</>
								)}
							</button>
						))}
						<span className='fight-skill-group'>
							{SKILL_IDS.map((id, i) => {
								const skill = SKILLS[id];
								const locked = player.level < skill.unlockLevel;
								const left = cd[id];
								const key = (p.potionSlots ?? COMBAT.potionBaseSlots) + 1 + i;
								const detail = locked
									? `Unlocks at level ${skill.unlockLevel}.`
									: `Costs ${skill.manaCost} mana, cooldown ${skill.cooldownSec} s. Press ${key} or click.`;
								return (
									<span key={id} className='fight-skill-wrap'>
										<HoverTip placement='above' align='center' tip={<HintTooltip title={skill.name} text={`${skillDescription(skill)} ${detail}`} />}>
											<button
												type='button'
												disabled={locked}
												onClick={() => p.onSkill?.(id)}
												className='fight-skill'
												data-locked={locked}
												data-nomana={!locked && player.mp < skill.manaCost}
												aria-label={`${skill.name}. ${detail}`}
											>
												{/* eslint-disable-next-line @next/next/no-img-element */}
												<img className='fight-skill-icon' src={SKILL_ICONS[id]} alt='' draggable={false} />
												<span className='fight-hotkey'>{key}</span>
												{!locked && left > 0 && (
													<>
														<span className='fight-cooldown' style={{ height: `${Math.min(100, (left / skill.cooldownSec) * 100)}%` }} />
														<b className='fight-cd-num'>{Math.ceil(left)}</b>
													</>
												)}
											</button>
										</HoverTip>
										<span className='fight-skill-cost' data-short={!locked && player.mp < skill.manaCost}>
											{skill.manaCost} MP
										</span>
									</span>
								);
							})}
						</span>
					</div>
				</>
			)}
			<div className='combat-switches'>
				{/* only shown once it is unlocked (the first rebirth): no greyed-out switch before that */}
				{!p.autoLocked && (
					<span title='After a fight the server sends you against the next monster, one at a time. Off: click a monster to fight it'>
						<Checkbox checked={p.autoBattle} onChange={p.onAutoBattle} label='Auto-battle' />
					</span>
				)}
				{p.autoBattle && !fight && p.autoNote === 'no_winnable' && (
					<span className='px-tip-muted text-xs' title='Click a monster to fight it anyway'>
						Waiting: no monster looks winnable
					</span>
				)}
				{!p.autoUseLocked && (
					<span title={`Drinks a potion below ${COMBAT.auto.potionBelowHpPct}% HP, casts Heal below ${COMBAT.auto.healBelowHpPct}%, Stun when ready`}>
						<Checkbox checked={p.autoUse} onChange={p.onAutoUse} label='Auto-use' />
					</span>
				)}
			</div>
		</>
	);

	// the monster's picture on the stage, sized from its map size
	const art = wip ? (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={monsterSpriteUrl(wip)}
			alt={wip.label}
			draggable={false}
			style={{
				width: monsterArtSize(wip.id, wip.grade) * STAGE_ART_FACTOR,
				height: monsterArtSize(wip.id, wip.grade) * STAGE_ART_FACTOR,
				objectFit: 'contain',
				imageRendering: 'pixelated',
			}}
		/>
	) : (
		<MonsterArt type={monster.type} scale={isBoss(monster.type) ? 1.5 : 2} />
	);

	return (
		<div className='combat-stack' onMouseEnter={p.onMouseEnter} onMouseLeave={p.onMouseLeave}>
			<section
				className='ds-root combat-widget'
				aria-label='Combat'
				data-dead={dead}
				style={
					{
						'--bg-dim': COMBAT_BACKGROUND_STYLE.dim,
						'--bg-dim-dead': COMBAT_BACKGROUND_STYLE.dimDead,
						'--bg-pan': `${COMBAT_BACKGROUND_STYLE.panSec}s`,
						'--bg-zoom': COMBAT_BACKGROUND_STYLE.zoom,
					} as React.CSSProperties
				}
			>
				<div className='fight-body' data-shake={p.shake && !over}>
					<div className='fight-hurt-flash' data-on={p.shake && !over} aria-hidden />
					<div className='combat-scene'>
						{bgUrl && <span key={sceneKey} className='combat-bg' style={{ backgroundImage: `url(${bgUrl})` }} aria-hidden />}
						<header className='combat-head'>
							<b>{`${boss ? '☠ ' : ''}${label} - Lv ${monster.level}`}</b>
							<span className='flex gap-1'>
								{fight && (
									<button
										className='combat-flee'
										onClick={p.onFlee}
										aria-label='Flee from the fight'
										title='Leave the fight: no reward, no penalty, the monster stays. Switches Auto-battle off'
									>
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

						{boss && (
							<div className='fight-boss' title='A boss: its own drops, crits and sometimes resists Stun'>
								<b>BOSS</b>
								<span className='fight-boss-traits'>
									Crits {formatCompact(traits.critChance)}% - resists Stun {formatCompact(traits.stunResist)}% - armor {formatCompact(Math.round(traits.armor))}
								</span>
								{describeModifiers(def.modifiers).map((chip) => (
									<span key={chip.key} className='fight-mod' data-mod={chip.key} title={chip.text}>
										{chip.label}
									</span>
								))}
							</div>
						)}
						{fight && fight.timeLeftSec !== null && (
							<div className='fight-timer' data-low={fight.timeLeftSec <= 10}>
								Time left: {Math.ceil(fight.timeLeftSec)} s
							</div>
						)}
						<div className='combat-stage' data-lucky={!!monster.lucky && !dead} data-dead={dead}>
							{!dead && (
								<div className='fight-monster-bar'>
									<Bar value={p.monsterHp} max={p.monsterMaxHp} kind='monster' label='' snapKey={p.snapKey} />
								</div>
							)}
							<span key={hpKey} className='fight-sprite' data-hit={!over && p.hitTick > 0} data-loading={p.loading}>
								<span style={flip && !dead ? { display: 'block', transform: 'scaleX(-1)' } : undefined}>
									{dead ? (
										<span className='fight-dead' role='img' aria-label={`${label} defeated`}>
											<span className='fight-dead-monster'>{art}</span>
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img className='fight-dead-skull' src='/fx/dead.png' alt='' draggable={false} width={48} height={48} />
										</span>
									) : (
										art
									)}
								</span>
							</span>
							{p.loading && <div className='fight-loading'>Engaging...</div>}
							{monster.lucky && !dead && (
								<span className='fight-sparks' aria-hidden>
									{[0, 1, 2, 3, 4, 5].map((i) => (
										<i key={i} style={{ left: `${12 + i * 15}%`, animationDelay: `${i * 0.37}s` }}>
											✦
										</i>
									))}
								</span>
							)}
							{fight && fight.stunLeft > 0 && <div className='fight-stunned'>Stunned {tidy(fight.stunLeft.toFixed(1))} s</div>}
							{over && !dead && (
								<div className='fight-defeat' role='status'>
									<div className='victory-title'>{over.kind === 'defeated' ? `Knocked out by the ${def.label}` : `Time ran out against the ${def.label}`}</div>
									{over.taunt && <div className='victory-note italic'>&ldquo;{over.taunt}&rdquo;</div>}
									<div className='victory-note'>The monster stays where it is.</div>
								</div>
							)}
							{p.slashes?.map((fx) => (
								<span
									key={fx.id}
									className='fight-slash'
									data-hero={fx.onHero}
									data-mirror={fx.mirror}
									aria-hidden
									style={
										{
											'--slash-w': `${SLASH_FRAME.w}px`,
											'--slash-h': `${SLASH_FRAME.h}px`,
											'--slash-frames': SLASH_SHEETS[fx.name].frames,
											'--slash-ms': `${SLASH_SHEETS[fx.name].ms}ms`,
											'--slash-sheet': `url(/fx/slash/${fx.name}.png)`,
										} as React.CSSProperties
									}
								/>
							))}
							{p.numbers.map((n) => (
								<span
									key={n.id}
									className='fight-number'
									data-kind={n.kind}
									// each number leans and drifts its own way (from its id, so a number keeps its look between renders)
									style={{ left: `${n.x}%`, '--dx': `${((n.id * 37) % 41) - 20}px`, '--rot': `${((n.id * 17) % 13) - 6}deg` } as React.CSSProperties}
								>
									{n.text}
								</span>
							))}
						</div>
					</div>
					{over && dead && <FightResult notice={over} />}
					<div className='fight-bars-row'>
						<Bar value={player.hp} max={player.maxHp} kind='player' label='You' snapKey={p.snapKey} />
						<Bar value={player.mp} max={player.maxMp} kind='mana' label='Mana' snapKey={p.snapKey} />
					</div>
					{p.restSec != null && (
						<div className='fight-rest' role='status' title='The next queued fight starts by itself once your HP is back to the resume line'>
							Resting before the next fight{p.restLabel ? ` (${p.restLabel})` : ''}: {formatRest(p.restSec)}
						</div>
					)}
					{controls(!!over)}
				</div>
			</section>
			<CombatQueue queue={p.queue} queueMax={p.queueMax} onUnqueue={p.onUnqueue} compact={compact} onCompact={setCompact} />
		</div>
	);
};

export default CombatPanel;
