import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatCompact } from '@/utils/formatters';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { SKILLS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { monsterDef, monsterStats } from '@/lib/monsters';
import { COMBAT_EVENT, type CombatFx } from '@/lib/combatFx';
import audioManager from '@/utils/audioManager';
import MonsterArt from '../MonsterArt';
import ItemSlot from '../ItemSlot';
import NotifyDot from '../NotifyDot';
import { slotProps } from '../itemUi';
import '@/styles/Fight.css';
import '@/styles/CombatWidget.css';

interface FloatNumber {
	id: number;
	text: string;
	kind: 'dmg' | 'crit' | 'super' | 'hurt' | 'heal' | 'stun' | 'resist';
	x: number;
}

const Bar: React.FC<{ value: number; max: number; kind: 'monster' | 'player' | 'mana'; label: string }> = ({ value, max, kind, label }) => {
	const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
	return (
		<div className='fight-bar' data-kind={kind} aria-label={label}>
			<div className='fight-bar-trail' style={{ width: `${pct}%` }} />
			<div className='fight-bar-fill' style={{ width: `${pct}%` }} />
			<div className='fight-bar-text'>
				{label} {formatCompact(Math.ceil(value))} / {formatCompact(Math.round(max))}
			</div>
		</div>
	);
};

const typingInField = (target: EventTarget | null): boolean => {
	const el = target as HTMLElement | null;
	return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * The combat panel, shown only while a fight is open. A click on a monster starts the fight (or Auto-battle does, one monster after the
 * other); the server then swings both ways at each side's attack speed (see src/lib/offline/fight.ts), so this only shows what it says.
 * Potions and skills are used with the number keys (their slots are not buttons); the switches (also in the right-click menu) are
 * Auto-battle and Auto-use (it drinks, heals and stuns with fixed rules).
 * The panel shrinks to an icon, and a win or defeat is announced by the notice stack either way.
 */
const CombatWidget: React.FC = () => {
	const combat = useGameStore((state) => state.combat);
	const playerHp = useGameStore((state) => state.playerHp);
	const playerMp = useGameStore((state) => state.playerMp);
	const bag = useGameStore((state) => state.bag);
	const level = useGameStore((state) => state.level.level);
	const requestPotion = useGameStore((state) => state.requestPotion);
	const requestSkill = useGameStore((state) => state.requestSkill);
	const setAutoBattle = useGameStore((state) => state.setAutoBattle);
	const setAutoUse = useGameStore((state) => state.setAutoUse);
	const minimized = useUiStore((state) => state.combatMinimized);
	const setPref = useUiStore((state) => state.setPref);

	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const [hitTick, setHitTick] = useState(0);
	const [shake, setShake] = useState(false);
	const nextId = useRef(1);
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const fight = combat.fight;
	const pushNumber = useCallback((text: string, kind: FloatNumber['kind']) => {
		const id = nextId.current++;
		setNumbers((prev) => [...prev.slice(-8), { id, text, kind, x: 20 + Math.random() * 60 }]);
		setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== id)), 900);
	}, []);

	// The picture is driven by the events the server reported (see the store's playFx)
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
				audioManager.playSound('wrong');
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

	// the server has not said anything yet, or no fight is open: the panel (and its icon) only exist while one is
	if (combat.maxHp <= 0 || !fight) return null;

	const hpPct = Math.max(0, Math.min(100, (playerHp / combat.maxHp) * 100));

	if (minimized) {
		return (
			<button
				className='combat-icon'
				data-fighting={!!fight}
				onClick={() => setPref('combatMinimized', false)}
				title={`Fighting a ${monsterDef(fight.type).label} - click to open`}
				aria-label='Open the combat panel'>
				<span className='combat-icon-art' aria-hidden>
					<MonsterArt type={fight.type} scale={2} />
				</span>
				<span className='combat-icon-hp' aria-hidden>
					<i style={{ width: `${hpPct}%` }} />
				</span>
				<NotifyDot show={!!combat.notice} label='Fight result waiting' />
			</button>
		);
	}

	const def = monsterDef(fight.type);
	const boss = def.grade === 'boss';
	const traits = monsterStats(fight.type, fight.level);

	return (
		<section className='combat-widget px-card' aria-label='Combat'>
			<header className='combat-head'>
				<b>{`${boss ? '☠ ' : ''}${def.label} - Lv ${fight.level}`}</b>
				<button className='combat-min' onClick={() => setPref('combatMinimized', true)} aria-label='Minimize the combat panel' title='Minimize'>
					_
				</button>
			</header>
			<div className='fight-body' data-shake={shake}>
				<div className='fight-hurt-flash' data-on={shake} aria-hidden />
				{boss && (
					<div className='fight-boss' title='A boss: its own drops, crits and sometimes resists Stun'>
						<b>BOSS</b>
						<span className='fight-boss-traits'>
							Crits {formatCompact(traits.critChance)}% - resists Stun {formatCompact(traits.stunResist)}% - armor {formatCompact(Math.round(traits.armor))}
						</span>
					</div>
				)}
				{fight.timeLeftSec !== null && (
					<div className='fight-timer' data-low={fight.timeLeftSec <= 10}>
						Time left: {Math.ceil(fight.timeLeftSec)} s
					</div>
				)}
				<div className='combat-stage'>
					<span key={hitTick} className='fight-sprite' data-hit={hitTick > 0}>
						<MonsterArt type={fight.type} scale={fight.type === 'ratKing' ? 3 : 4} />
					</span>
					{fight.stunLeft > 0 && <div className='fight-stunned'>Stunned {fight.stunLeft.toFixed(1)} s</div>}
					{numbers.map((n) => (
						<span key={n.id} className='fight-number' data-kind={n.kind} style={{ left: `${n.x}%` }}>
							{n.text}
						</span>
					))}
				</div>
				<Bar value={fight.monsterHp} max={fight.monsterMaxHp} kind='monster' label={def.label} />
				<Bar value={playerHp} max={combat.maxHp} kind='player' label='You' />
				<Bar value={playerMp} max={combat.maxMp} kind='mana' label='Mana' />

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
				<div className='combat-switches'>
					<label title='After a fight the server sends you against the next monster, one at a time. Off: click a monster to fight it'>
						<input type='checkbox' checked={combat.autoBattle} onChange={(e) => setAutoBattle(e.target.checked)} /> Auto-battle
					</label>
					<label title={`Drinks a potion below ${COMBAT.auto.potionBelowHpPct}% HP, casts Heal below ${COMBAT.auto.healBelowHpPct}%, Stun when ready`}>
						<input type='checkbox' checked={combat.autoUse} onChange={(e) => setAutoUse(e.target.checked)} /> Auto-use
					</label>
				</div>
			</div>
		</section>
	);
};

export default CombatWidget;
