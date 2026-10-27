import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { COMBAT, MONSTERS } from '@/config/combatConfig';
import { maxHp, maxMana } from '@/lib/combat';
import audioManager from '@/utils/audioManager';
import type { FightState, KillSummary } from '@/types/game';
import ItemSlot from '../ItemSlot';
import ResourceIcon from '../ResourceIcon';
import '@/styles/Fight.css';

interface Victory {
	id: number;
	title: string;
	boss: boolean;
	summary: KillSummary;
	hp: number;
	hpMax: number;
	mp: number;
	mpMax: number;
}

let nextId = 1;

/**
 * What a won fight leaves behind, shown at the bottom of the screen instead of a window you have to confirm: a fast clicker
 * cannot hit "Close" by accident, and the loot stays up (hover it for the item card) until it times out or is dismissed. The
 * fight window closes the moment the monster falls; this takes over.
 */
const VictoryToast: React.FC = () => {
	const fight = useGameStore((state) => state.fight);
	const leaveFight = useGameStore((state) => state.leaveFight);
	const [victory, setVictory] = useState<Victory | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const handled = useRef<FightState | null>(null);

	const dismiss = useCallback(() => {
		clearTimeout(timer.current);
		setVictory(null);
	}, []);

	const arm = useCallback(() => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setVictory(null), COMBAT.victoryToastSec * 1000);
	}, []);

	useEffect(() => {
		if (!fight || fight.phase !== 'won' || !fight.summary || handled.current === fight) return;
		handled.current = fight;
		const state = useGameStore.getState();
		const def = MONSTERS[fight.type];
		setVictory({
			id: nextId++,
			title: `${def.grade === 'boss' ? '☠ ' : ''}${def.label} (Lv ${fight.level}) defeated`,
			boss: def.grade === 'boss',
			summary: fight.summary,
			hp: state.playerHp,
			hpMax: maxHp(state.characterStats, state.equipment),
			mp: state.playerMp,
			mpMax: maxMana(state.characterStats, state.equipment),
		});
		audioManager.playSound('fanfare');
		arm();
		leaveFight(); // the fight window is gone; the toast stays
	}, [fight, arm, leaveFight]);

	useEffect(() => () => clearTimeout(timer.current), []);

	if (!victory) return null;
	const { summary } = victory;
	return (
		<div
			key={victory.id}
			className='victory-toast px-toast'
			data-boss={victory.boss}
			role='status'
			onMouseEnter={() => clearTimeout(timer.current)}
			onMouseLeave={arm}>
			<button className='victory-close' onClick={dismiss} aria-label='Dismiss'>
				x
			</button>
			<div className='victory-title'>{victory.title}</div>
			<div className='victory-row'>
				<span className='flex items-center gap-1'>
					+{Math.floor(summary.gold)} <ResourceIcon resource='gold' />
				</span>
				<span className='flex items-center gap-1'>
					+{Math.floor(summary.xp)} <ResourceIcon resource='xp' />
				</span>
				<span className='victory-status'>
					HP {Math.ceil(victory.hp)}/{victory.hpMax} - MP {Math.floor(victory.mp)}/{victory.mpMax}
				</span>
			</div>
			{summary.items.length > 0 ? (
				<div className='victory-loot'>
					{summary.items.map((drop, i) =>
						drop.kind === 'gear' ? <ItemSlot key={i} item={drop.item} /> : <ItemSlot key={i} itemId={drop.id} qty={drop.qty} />
					)}
				</div>
			) : (
				<div className='victory-note'>No drops this time</div>
			)}
			{summary.autoSold.count > 0 && (
				<div className='victory-note'>
					Auto-sold {summary.autoSold.count} piece{summary.autoSold.count === 1 ? '' : 's'} of gear for {summary.autoSold.gold} gold
				</div>
			)}
			{summary.convertedGold > 0 && <div className='victory-note'>Bag full - {summary.convertedGold} gold paid for the drops that did not fit</div>}
		</div>
	);
};

export default VictoryToast;
