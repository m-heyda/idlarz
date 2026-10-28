import React, { useCallback, useEffect, useRef } from 'react';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { useGameStore } from '@/stores/gameStore';
import { COMBAT } from '@/config/combatConfig';
import { monsterDef } from '@/lib/monsters';
import audioManager from '@/utils/audioManager';
import ItemSlot from '../ItemSlot';
import ResourceIcon from '../ResourceIcon';
import '@/styles/Fight.css';

/**
 * What a fight leaves behind, shown at the top of the screen whether or not the combat panel is open (that is how a minimized fight
 * is announced): the loot of a win stays up (hover it for the item card) until it times out or is dismissed, a defeat or a timeout says
 * so. The server reports the result, the store has already put the loot in the bag; this only tells the player.
 */
const VictoryToast: React.FC = () => {
	const notice = useGameStore((state) => state.combat.notice);
	const maxHp = useGameStore((state) => state.combat.maxHp);
	const playerHp = useGameStore((state) => state.playerHp);
	const clear = useGameStore((state) => state.clearCombatNotice);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const dismiss = useCallback(() => {
		clearTimeout(timer.current);
		clear();
	}, [clear]);

	const arm = useCallback(() => {
		clearTimeout(timer.current);
		timer.current = setTimeout(clear, COMBAT.victoryToastSec * 1000);
	}, [clear]);

	const noticeId = notice?.id;
	const noticeKind = notice?.kind;
	useEffect(() => {
		if (noticeId === undefined) return;
		if (noticeKind === 'won') audioManager.playSound('fanfare');
		arm();
		return () => clearTimeout(timer.current);
	}, [noticeId, noticeKind, arm]);

	if (!notice) return null;
	const def = monsterDef(notice.type);
	const boss = def.grade === 'boss';
	const name = `${boss ? '☠ ' : ''}${def.label} (Lv ${formatCompact(notice.level)})`;

	if (notice.kind !== 'won' || !notice.summary) {
		return (
			<div key={notice.id} className='victory-toast px-toast' data-boss={boss} role='status' onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={arm}>
				<button className='victory-close' onClick={dismiss} aria-label='Dismiss'>
					x
				</button>
				<div className='victory-title'>{notice.kind === 'defeated' ? `Knocked out by the ${name}` : `Time ran out against the ${name}`}</div>
				{notice.taunt && <div className='victory-note italic'>&ldquo;{notice.taunt}&rdquo;</div>}
				<div className='victory-note'>
					The monster stays where it is. HP {formatCompact(Math.ceil(playerHp))}/{formatCompact(maxHp)}
				</div>
			</div>
		);
	}

	const { summary } = notice;
	return (
		<div key={notice.id} className='victory-toast px-toast' data-boss={boss} role='status' onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={arm}>
			<button className='victory-close' onClick={dismiss} aria-label='Dismiss'>
				x
			</button>
			<div className='victory-title'>{name} defeated</div>
			<div className='victory-row'>
				<span className='flex items-center gap-1'>
					+{formatNumber(Math.floor(summary.gold))} <ResourceIcon resource='gold' />
				</span>
				<span className='flex items-center gap-1'>
					+{formatNumber(Math.floor(summary.xp))} <ResourceIcon resource='xp' />
				</span>
				<span className='victory-status'>
					HP {formatCompact(Math.ceil(playerHp))}/{formatCompact(maxHp)}
				</span>
			</div>
			{summary.items.length > 0 ? (
				<div className='victory-loot'>
					{summary.items.map((drop, i) => (drop.kind === 'gear' ? <ItemSlot key={i} item={drop.item} /> : <ItemSlot key={i} itemId={drop.id} qty={drop.qty} />))}
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
			{summary.convertedGold > 0 && <div className='victory-note'>Bag full - {formatNumber(summary.convertedGold)} gold paid for the drops that did not fit</div>}
		</div>
	);
};

export default VictoryToast;
