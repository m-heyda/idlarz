import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { useRewardPendingStore } from '@/stores/rewardPendingStore';
import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { SKILLS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { autoBattleUnlocked } from '@/lib/combat';
import { monsterDef, monsterStats } from '@/lib/monsters';
import { COMBAT_EVENT, type CombatFx } from '@/lib/combatFx';
import audioManager from '@/utils/audioManager';
import MonsterArt from '../MonsterArt';
import ItemSlot from '../ItemSlot';
import NotifyDot from '../NotifyDot';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';
import { slotProps } from '../itemUi';
import type { FightView } from '@/lib/offline/fightTypes';
import type { CombatNotice } from '@/types/game';
import '@/styles/Fight.css';
import '@/styles/CombatWidget.css';

interface FloatNumber {
	id: number;
	text: string;
	kind: 'dmg' | 'crit' | 'super' | 'hurt' | 'heal' | 'stun' | 'resist';
	x: number;
}

/** How long a bar takes to run to a new number: about the time since the last answer, which is when the next one comes (null: no run, it jumps). */
const drainMs = (sinceLastAnswerMs: number): number | null => (sinceLastAnswerMs > 6000 ? null : Math.max(350, Math.min(2600, sinceLastAnswerMs)));

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

const typingInField = (target: EventTarget | null): boolean => {
	const el = target as HTMLElement | null;
	return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
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

/**
 * The combat window. It opens the moment a monster is clicked (a loading state until the server answers), shows the fight (HP bars that
 * drain smoothly between the server's answers), and when the fight is over it is the same window with the result in it: the bars finish
 * draining, then the monster lies dead (red cross) with its loot under it, until the window is closed (or after a while). A click on a
 * monster starts the fight (or Auto-battle does, one monster after the other); the server swings both ways at each side's attack speed
 * (see src/lib/offline/fight.ts), so this only shows what it says. Flee leaves a fight (and switches Auto-battle off).
 * Potions and skills are used with the number keys (their slots are not buttons); the switches (also in the right-click menu) are
 * Auto-battle and Auto-use (it drinks, heals and stuns with fixed rules).
 * The window shrinks to an icon (a click on a monster opens it again).
 */
const CombatWidget: React.FC = () => {
	const combat = useGameStore((state) => state.combat);
	const playerHp = useGameStore((state) => state.playerHp);
	const playerMp = useGameStore((state) => state.playerMp);
	const bag = useGameStore((state) => state.bag);
	const level = useGameStore((state) => state.level.level);
	const autoLocked = useGameStore((state) => !autoBattleUnlocked(state.prestige.rebirths));
	const requestPotion = useGameStore((state) => state.requestPotion);
	const requestSkill = useGameStore((state) => state.requestSkill);
	const setAutoBattle = useGameStore((state) => state.setAutoBattle);
	const setAutoUse = useGameStore((state) => state.setAutoUse);
	const flee = useGameStore((state) => state.flee);
	const clearNotice = useGameStore((state) => state.clearCombatNotice);
	const minimized = useUiStore((state) => state.combatMinimized);
	const setPref = useUiStore((state) => state.setPref);

	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const [hitTick, setHitTick] = useState(0);
	const [shake, setShake] = useState(false);
	const nextId = useRef(1);
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const fight = combat.fight;
	const pending = combat.pending;
	const notice = combat.notice;
	const pushNumber = useCallback((text: string, kind: FloatNumber['kind']) => {
		const id = nextId.current++;
		setNumbers((prev) => [...prev.slice(-8), { id, text, kind, x: 20 + Math.random() * 60 }]);
		setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== id)), 900);
	}, []);

	// The picture is driven by the events the server reported (see the store's playFx). Being hit makes the window shake and flash, with no
	// sound: a sound on every bite was confusing next to the sounds of the rest of the game.
	useEffect(() => {
		const onFx = (e: Event) => {
			const fx = (e as CustomEvent<CombatFx>).detail;
			if (fx.kind === 'hit') {
				setHitTick((t) => t + 1);
				pushNumber(fx.crit === 'none' ? `-${formatCompact(fx.damage)}` : `-${formatCompact(fx.damage)}!`, fx.crit === 'none' ? 'dmg' : fx.crit);
			} else if (fx.kind === 'hurt') {
				setShake(true);
				clearTimeout(shakeTimer.current);
				shakeTimer.current = setTimeout(() => setShake(false), 320);
				pushNumber(fx.crit ? `-${formatCompact(fx.amount)}!` : `-${formatCompact(fx.amount)}`, 'hurt');
			} else if (fx.kind === 'heal') {
				pushNumber(`+${formatCompact(fx.amount)}`, 'heal');
				audioManager.playSound('purchase');
			} else if (fx.kind === 'resist') pushNumber('Resisted!', 'resist');
			else if (fx.kind === 'stun') pushNumber('Stunned!', 'stun');
		};
		window.addEventListener(COMBAT_EVENT, onFx);
		return () => {
			window.removeEventListener(COMBAT_EVENT, onFx);
			clearTimeout(shakeTimer.current);
		};
	}, [pushNumber]);

	// The last fight the server reported stays in hand after it ends: the window keeps showing it while its bars finish draining
	const lastFight = useRef<{ fight: FightView; at: number } | null>(null);
	useEffect(() => {
		if (fight) lastFight.current = { fight, at: performance.now() };
		else if (!notice && !pending) lastFight.current = null;
	}, [fight, notice, pending]);

	// The result takes the place of the fight once the bars have run to their last numbers (about the time since the server's last
	// answer, as the bars themselves take): the window never goes away in between. Without a fight to finish (the kill happened while
	// away) there is nothing to wait for.
	const noticeId = notice?.id;
	const noticeKind = notice?.kind;
	const [revealedId, setRevealedId] = useState<number>();
	const showResult = !!notice && !fight && !pending && (revealedId === noticeId || !lastFight.current);
	useEffect(() => {
		if (noticeId === undefined || fight || pending || revealedId === noticeId) return;
		const last = lastFight.current;
		const wait = last ? (drainMs(performance.now() - last.at) ?? 0) : 0;
		const timer = setTimeout(() => setRevealedId(noticeId), wait);
		return () => clearTimeout(timer);
	}, [noticeId, fight, pending, revealedId]);

	// A win whose result is not shown yet (the bars are still draining): the little chest covers the wait for the loot
	const awaitingLoot = noticeKind === 'won' && !fight && !pending && !showResult;
	useEffect(() => {
		if (!awaitingLoot) return;
		const { begin, end } = useRewardPendingStore.getState();
		begin();
		return end;
	}, [awaitingLoot]);

	// A won fight is announced with the fanfare as the result appears; the result closes itself after a while (hover keeps it open)
	const armClose = useCallback(() => {
		clearTimeout(closeTimer.current);
		closeTimer.current = setTimeout(clearNotice, COMBAT.victoryToastSec * 1000);
	}, [clearNotice]);
	useEffect(() => {
		if (!showResult) return;
		if (noticeKind === 'won') audioManager.playSound('fanfare');
		armClose();
		return () => clearTimeout(closeTimer.current);
	}, [showResult, noticeId, noticeKind, armClose]);

	// Up to three potion stacks from the bag, with hotkeys 1-3
	const potions = bag
		.map((slot, index) => ({ slot, index }))
		.filter(({ slot }) => slot && 'id' in slot && ITEM_CATALOG[slot.id]?.consumable)
		.slice(0, 3);

	// Hotkeys: 1-3 drink the potions, 4 and 5 cast the skills (the server decides whether it goes through)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (typingInField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
			const n = Number(e.key);
			if (!Number.isInteger(n) || n < 1) return;
			const potion = potions[n - 1]?.slot;
			if (n <= 3 && potion && 'id' in potion) requestPotion(potion.id);
			else if (n >= 4 && n < 4 + SKILL_IDS.length) requestSkill(SKILL_IDS[n - 4]);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [potions, requestPotion, requestSkill]);

	// nothing to show: the server has not said anything yet, or there is no fight, no click waiting for the server and no result to read
	if (combat.maxHp <= 0 || (!fight && !pending && !notice)) return null;

	const hpPct = Math.max(0, Math.min(100, (playerHp / combat.maxHp) * 100));

	// what the window is about: the open fight, the monster that was just clicked (the server has not answered yet), or the last result
	const type = fight?.type ?? pending?.type ?? notice!.type;
	const monsterLevel = fight?.level ?? pending?.level ?? notice!.level;
	const def = monsterDef(type);
	const boss = def.grade === 'boss';

	// a click on a monster opens the window at once, minimized or not
	if (minimized && !pending) {
		// a won fight leaves the monster dead: grey, with a skull over it (the loot dot stays)
		const slain = !fight && notice?.kind === 'won';
		return (
			<button
				className='combat-icon'
				data-fighting={!!fight}
				data-slain={slain}
				onClick={() => setPref('combatMinimized', false)}
				title={fight ? `Fighting a ${def.label} - click to open` : `The fight against the ${def.label} is over - click to see the result`}
				aria-label='Open the combat panel'>
				<span className='combat-icon-art' aria-hidden>
					<MonsterArt type={type} scale={2} />
					{slain && <PixelIcon name='skull' scale={0.5} className='combat-icon-skull' />}
				</span>
				<span className='combat-icon-hp' aria-hidden>
					<i style={{ width: `${hpPct}%` }} />
				</span>
				<NotifyDot show={!fight && !!notice} label='Fight result waiting' />
			</button>
		);
	}

	const traits = monsterStats(type, monsterLevel);
	// the same window for the fight and its result: the bars stay, the stage shows the monster dead after a win, the loot comes under it
	const over = showResult ? notice! : null;
	const dead = over?.kind === 'won';
	const shownFight = fight ?? lastFight.current?.fight ?? null;
	const monsterHp = dead ? 0 : (shownFight?.monsterHp ?? traits.maxHp);
	const monsterMaxHp = shownFight?.monsterMaxHp ?? traits.maxHp;
	const snapKey = shownFight ? `fight-${shownFight.n}` : pending ? 'pending' : `notice-${noticeId}`;

	/** The hotkey slots and the potions (a fight only), and the two switches */
	const controls = (switchesOnly: boolean) => (
		<>
			{!switchesOnly && (
				<>
					{/* Hotkey slots: they show what is ready, they are not buttons */}
					<div className='fight-skills'>
						{SKILL_IDS.map((id, i) => {
							const skill = SKILLS[id];
							const locked = level < skill.unlockLevel;
							const cd = combat.cd[id];
							return (
								<div
									key={id}
									className='fight-skill'
									data-locked={locked}
									data-nomana={!locked && playerMp < skill.manaCost}
									title={`${skill.name}: ${skillDescription(skill)} (${locked ? `unlocks at level ${skill.unlockLevel}` : `${skill.manaCost} mana, ${skill.cooldownSec} s cooldown`}). Press ${4 + i}.`}>
									<span className='fight-skill-name'>{skill.name}</span>
									<span className='fight-skill-cost'>{locked ? `Lv ${skill.unlockLevel}` : `${skill.manaCost} MP`}</span>
									<span className='fight-hotkey'>{4 + i}</span>
									{!locked && cd > 0 && <span className='fight-cooldown' style={{ height: `${Math.min(100, (cd / skill.cooldownSec) * 100)}%` }} />}
								</div>
							);
						})}
					</div>
					<div className='fight-potions'>
						{potions.length === 0 && <span className='px-tip-muted text-xs'>No potions</span>}
						{potions.map(({ slot }, i) => (
							<div key={i} className='fight-potion' title={`Press ${i + 1} to drink`}>
								<ItemSlot {...slotProps(slot)} />
								<span className='fight-hotkey'>{i + 1}</span>
								{combat.cd.potion > 0 && <span className='fight-cooldown' style={{ height: `${Math.min(100, (combat.cd.potion / COMBAT.potionCooldownSec) * 100)}%` }} />}
							</div>
						))}
					</div>
				</>
			)}
			<div className='combat-switches'>
				<label
					title={autoLocked ? 'Unlocks after your first rebirth' : 'After a fight the server sends you against the next monster, one at a time. Off: click a monster to fight it'}
					data-locked={autoLocked}>
					<input type='checkbox' checked={combat.autoBattle && !autoLocked} disabled={autoLocked} onChange={(e) => setAutoBattle(e.target.checked)} /> Auto-battle
				</label>
				<label title={`Drinks a potion below ${COMBAT.auto.potionBelowHpPct}% HP, casts Heal below ${COMBAT.auto.healBelowHpPct}%, Stun when ready`}>
					<input type='checkbox' checked={combat.autoUse} onChange={(e) => setAutoUse(e.target.checked)} /> Auto-use
				</label>
			</div>
		</>
	);

	return (
		<section className='combat-widget px-card' aria-label='Combat' onMouseEnter={() => clearTimeout(closeTimer.current)} onMouseLeave={() => showResult && armClose()}>
			<header className='combat-head'>
				<b>{`${boss ? '☠ ' : ''}${def.label} - Lv ${monsterLevel}`}</b>
				<span className='flex gap-1'>
					{fight && (
						<button className='combat-flee' onClick={flee} aria-label='Flee from the fight' title='Leave the fight: no reward, no penalty, the monster stays. Switches Auto-battle off'>
							Flee
						</button>
					)}
					{over && (
						<button className='combat-min' onClick={clearNotice} aria-label='Close the result' title='Close'>
							x
						</button>
					)}
					<button className='combat-min' onClick={() => setPref('combatMinimized', true)} aria-label='Minimize the combat panel' title='Minimize'>
						_
					</button>
				</span>
			</header>
			<div className='fight-body' data-shake={shake && !over}>
				<div className='fight-hurt-flash' data-on={shake && !over} aria-hidden />
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
					<span key={dead ? 'dead' : hitTick} className='fight-sprite' data-hit={!over && hitTick > 0} data-loading={!fight && !notice}>
						<span className={dead ? 'fight-dead' : undefined}>
							<MonsterArt type={type} scale={type === 'ratKing' ? 3 : 4} />
						</span>
					</span>
					{!fight && !notice && <div className='fight-loading'>Engaging...</div>}
					{fight && fight.stunLeft > 0 && <div className='fight-stunned'>Stunned {fight.stunLeft.toFixed(1)} s</div>}
					{numbers.map((n) => (
						<span key={n.id} className='fight-number' data-kind={n.kind} style={{ left: `${n.x}%` }}>
							{n.text}
						</span>
					))}
				</div>
				{over && <FightResult notice={over} />}
				<Bar value={monsterHp} max={monsterMaxHp} kind='monster' label={def.label} snapKey={snapKey} />
				<Bar value={playerHp} max={combat.maxHp} kind='player' label='You' snapKey={snapKey} />
				<Bar value={playerMp} max={combat.maxMp} kind='mana' label='Mana' snapKey={snapKey} />
				{controls(!!over)}
			</div>
		</section>
	);
};

export default CombatWidget;
