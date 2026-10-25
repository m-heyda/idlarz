import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { COMBAT, MONSTERS } from '@/config/combatConfig';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { maxHp } from '@/lib/combat';
import { COMBAT_EVENT, type CombatFx } from '@/lib/combatFx';
import audioManager from '@/utils/audioManager';
import PixelModal from '../PixelModal';
import MonsterArt from '../MonsterArt';
import ItemSlot from '../ItemSlot';
import ResourceIcon from '../ResourceIcon';
import '@/styles/Fight.css';

interface FloatNumber {
	id: number;
	text: string;
	kind: 'dmg' | 'crit' | 'super' | 'hurt' | 'heal';
	x: number;
}

interface Burst {
	id: number;
	bits: { dx: number; dy: number; s: number }[];
}

const Bar: React.FC<{ value: number; max: number; kind: 'monster' | 'player'; label: string }> = ({
	value,
	max,
	kind,
	label,
}) => {
	const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
	return (
		<div className='fight-bar' data-kind={kind} aria-label={label}>
			<div className='fight-bar-trail' style={{ width: `${pct}%` }} />
			<div className='fight-bar-fill' style={{ width: `${pct}%` }} />
			<div className='fight-bar-text'>
				{label} {Math.ceil(value)} / {Math.round(max)}
			</div>
		</div>
	);
};

const FightView: React.FC = () => {
	const fight = useGameStore((state) => state.fight)!;
	const playerHp = useGameStore((state) => state.playerHp);
	const characterStats = useGameStore((state) => state.characterStats);
	const equipment = useGameStore((state) => state.equipment);
	const bag = useGameStore((state) => state.bag);
	const hitMonster = useGameStore((state) => state.hitMonster);
	const drinkPotion = useGameStore((state) => state.drinkPotion);
	const leaveFight = useGameStore((state) => state.leaveFight);

	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const [bursts, setBursts] = useState<Burst[]>([]);
	const [hitTick, setHitTick] = useState(0);
	const [shake, setShake] = useState(false);
	const nextId = useRef(1);
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const active = fight.phase === 'active';
	const hpMax = maxHp(characterStats, equipment);

	const pushNumber = useCallback((text: string, kind: FloatNumber['kind']) => {
		const id = nextId.current++;
		setNumbers((prev) => [...prev.slice(-8), { id, text, kind, x: 20 + Math.random() * 60 }]);
		setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== id)), 900);
	}, []);

	// Effects are driven by the store's combat events
	useEffect(() => {
		const onFx = (e: Event) => {
			const fx = (e as CustomEvent<CombatFx>).detail;
			if (fx.kind === 'hit') {
				const id = nextId.current++;
				const bits = Array.from({ length: fx.crit === 'super' ? 20 : fx.crit === 'crit' ? 13 : 8 }, () => ({
					dx: (Math.random() - 0.5) * 120,
					dy: -10 - Math.random() * 70,
					s: 4 + Math.floor(Math.random() * 3) * 2,
				}));
				setBursts((prev) => [...prev.slice(-4), { id, bits }]);
				setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 650);
				setHitTick((t) => t + 1);
				pushNumber(fx.crit === 'none' ? `-${fx.damage}` : `-${fx.damage}!`, fx.crit === 'none' ? 'dmg' : fx.crit);
				audioManager.playSound('click');
			} else if (fx.kind === 'hurt') {
				setShake(true);
				clearTimeout(shakeTimer.current);
				shakeTimer.current = setTimeout(() => setShake(false), 320);
				pushNumber(`-${fx.amount}`, 'hurt');
				audioManager.playSound('wrong');
			} else if (fx.kind === 'heal') {
				pushNumber(`+${fx.amount}`, 'heal');
				audioManager.playSound('purchase');
			}
		};
		window.addEventListener(COMBAT_EVENT, onFx);
		return () => {
			window.removeEventListener(COMBAT_EVENT, onFx);
			clearTimeout(shakeTimer.current);
		};
	}, [pushNumber]);

	useEffect(() => {
		if (fight.phase === 'won') audioManager.playSound('fanfare');
	}, [fight.phase]);

	// Up to three potion stacks from the bag, with hotkeys 1-3
	const potions = bag
		.map((slot, index) => ({ slot, index }))
		.filter(({ slot }) => slot && ITEM_CATALOG[slot.id]?.consumable)
		.slice(0, 3);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const n = Number(e.key);
			if (!active || !(n >= 1 && n <= 3) || !potions[n - 1]) return;
			drinkPotion(potions[n - 1].index);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [active, potions, drinkPotion]);

	const hit = (e: React.MouseEvent) => {
		if (!active) return;
		hitMonster({
			eventId: e.nativeEvent.timeStamp,
			now: performance.now(),
			trusted: e.nativeEvent.isTrusted,
		});
	};

	const def = MONSTERS[fight.type];
	const title = fight.type === 'rat' ? `${def.label} - Tier ${fight.tier}` : def.label;

	return (
		<PixelModal
			title={title}
			size='md'
			closeOnBackdrop={!active}
			onClose={leaveFight}>
			<div className='fight-body' data-shake={shake}>
				<div className='fight-hurt-flash' data-on={shake} aria-hidden />

				{fight.timeLeftSec !== null && active && (
					<div className='fight-timer' data-low={fight.timeLeftSec <= 10}>
						Time left: {Math.ceil(fight.timeLeftSec)} s
					</div>
				)}

				<Bar value={fight.monsterHp} max={fight.monsterMaxHp} kind='monster' label={def.label} />

				<div className='fight-stage'>
					<button
						className='fight-monster'
						disabled={!active}
						onClick={hit}
						aria-label={`Hit the ${def.label}`}>
						<span key={hitTick} className='fight-sprite' data-hit={hitTick > 0}>
							<MonsterArt type={fight.type} scale={fight.type === 'ratKing' ? 4 : 5} />
						</span>
						{bursts.map((b) => (
							<span key={b.id} className='fight-burst' aria-hidden>
								{b.bits.map((bit, i) => (
									<i
										key={i}
										style={
											{
												'--dx': `${bit.dx}px`,
												'--dy': `${bit.dy}px`,
												width: bit.s,
												height: bit.s,
											} as React.CSSProperties
										}
									/>
								))}
							</span>
						))}
					</button>
					{numbers.map((n) => (
						<span key={n.id} className='fight-number' data-kind={n.kind} style={{ left: `${n.x}%` }}>
							{n.text}
						</span>
					))}
					{!active && (
						<div className='fight-result px-card'>
							{fight.phase === 'won' && fight.summary && (
								<>
									<div className='px-h text-center'>Victory!</div>
									<div className='flex justify-center gap-4 text-sm'>
										<span className='flex items-center gap-1'>
											+{Math.floor(fight.summary.gold)} <ResourceIcon resource='gold' />
										</span>
										<span className='flex items-center gap-1'>
											+{Math.floor(fight.summary.xp)} <ResourceIcon resource='xp' />
										</span>
									</div>
									{fight.summary.items.length > 0 && (
										<div className='flex justify-center gap-2 mt-2'>
											{fight.summary.items.map((item) => (
												<ItemSlot key={item.id} itemId={item.id} qty={item.qty} />
											))}
										</div>
									)}
									{fight.summary.convertedGold > 0 && (
										<div className='px-tip-muted text-xs text-center mt-2'>
											Bag full - {fight.summary.convertedGold} gold paid for the drops that did not fit
										</div>
									)}
								</>
							)}
							{fight.phase === 'knockedOut' && (
								<div className='text-center'>
									<div className='px-h'>Knocked out</div>
									<div className='text-sm'>The {def.label} shrugs it off. You wake up a little later.</div>
									{fight.taunt && <div className='text-sm italic mt-1'>&ldquo;{fight.taunt}&rdquo;</div>}
								</div>
							)}
							{fight.phase === 'timeout' && (
								<div className='text-center'>
									<div className='px-h'>Time is up</div>
									<div className='text-sm italic'>&ldquo;{fight.taunt}&rdquo;</div>
								</div>
							)}
							<div className='flex justify-center mt-3'>
								<button className='px-btn px-btn-gold' onClick={leaveFight}>
									Close
								</button>
							</div>
						</div>
					)}
				</div>

				<Bar value={playerHp} max={hpMax} kind='player' label='You' />

				<div className='fight-actions'>
					<div className='fight-potions'>
						{potions.length === 0 && <span className='px-tip-muted text-xs'>No potions</span>}
						{potions.map(({ slot, index }, i) => (
							<div key={index} className='fight-potion'>
								<ItemSlot
									itemId={slot!.id}
									qty={slot!.qty}
									onClick={() => active && drinkPotion(index)}
								/>
								<span className='fight-hotkey'>{i + 1}</span>
								{fight.potionCd > 0 && (
									<span
										className='fight-cooldown'
										style={{ height: `${(fight.potionCd / COMBAT.potionCooldownSec) * 100}%` }}
									/>
								)}
							</div>
						))}
					</div>
					{active && (
						<button className='px-btn px-btn-sm' onClick={leaveFight}>
							Flee
						</button>
					)}
				</div>
			</div>
		</PixelModal>
	);
};

const FightModal: React.FC = () => {
	const open = useGameStore((state) => state.fight !== null);
	return open ? <FightView /> : null;
};

export default FightModal;
