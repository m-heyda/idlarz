import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { COMBAT } from '@/config/combatConfig';
import { EQUIPMENT_LAYOUT, EQUIPMENT_SLOT_LABEL } from '@/config/itemCatalog';
import { armorOf, critOdds, damagePerClick, maxHp } from '@/lib/combat';
import { aggregateStats } from '@/lib/inventory';
import { clearDrag, getDrag, setDrag } from '@/lib/inventoryDrag';
import type { EquipmentSlot } from '@/types/game';
import LevelDetails from '../LevelDetails';
import ItemSlot from '../ItemSlot';
import Bag from '../Bag';

const ABILITY_HINT = 'Ability slot - skills are coming soon';

const CharacterOverlay: React.FC = () => {
	const setMenuTab = useUiStore((state) => state.setMenuTab);
	const equipment = useGameStore((state) => state.equipment);
	const characterStats = useGameStore((state) => state.characterStats);
	const equipItem = useGameStore((state) => state.equipItem);
	const unequipItem = useGameStore((state) => state.unequipItem);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => setNotice(null), 2200);
		return () => clearTimeout(timer);
	}, [notice]);

	const blocked = () => (useGameStore.getState().fight ? 'Finish the fight first' : null);

	const takeOff = (slot: EquipmentSlot) => {
		if (!equipment[slot]) return;
		if (!unequipItem(slot)) setNotice(blocked() ?? 'Your bag is full');
	};

	const dropOnSlot = () => {
		const drag = getDrag();
		clearDrag();
		if (drag?.kind === 'bag' && !equipItem(drag.index)) setNotice(blocked() ?? 'Cannot equip that');
	};

	const gearSlot = (slot: EquipmentSlot) => (
		<ItemSlot
			key={slot}
			slot={slot}
			label={EQUIPMENT_SLOT_LABEL[slot]}
			itemId={equipment[slot]}
			equipped
			draggable
			onClick={() => takeOff(slot)}
			onDragStart={() => setDrag({ kind: 'equip', slot })}
			onDrop={dropOnSlot}
		/>
	);

	const armor = armorOf(equipment);
	const mitigation = Math.round((armor / (armor + COMBAT.armorK)) * 100);
	const odds = critOdds(characterStats, equipment);
	const gear = aggregateStats(equipment);
	const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

	return (
		<div className='flex gap-5 h-full'>
				{/* Paper doll: hero scene between the slot columns, weapon and shield below */}
				<div className='px-panel overflow-y-auto shrink-0'>
					<div className='inv-doll'>
						<div className='inv-col'>{EQUIPMENT_LAYOUT.left.map(gearSlot)}</div>
						<LevelDetails />
						<div className='inv-col'>{EQUIPMENT_LAYOUT.right.map(gearSlot)}</div>
					</div>

					<div className='inv-bottom'>
						{gearSlot('mainHand')}
						<div className='inv-center'>
							<div className='inv-readouts'>
								<div className='inv-readout'>
									<span className='inv-readout-label'>Damage</span>
									<span className='inv-readout-value'>{damagePerClick(equipment)}</span>
								</div>
								<div className='inv-readout' title={`${mitigation}% less damage taken`}>
									<span className='inv-readout-label'>Armor</span>
									<span className='inv-readout-value'>{armor}</span>
								</div>
								<div className='inv-readout'>
									<span className='inv-readout-label'>Max HP</span>
									<span className='inv-readout-value'>{maxHp(characterStats, equipment)}</span>
								</div>
								<div className='inv-readout' title={`Chance that a click crits (x${COMBAT.crit.mult}); a crit becomes a super crit (x${COMBAT.crit.superMult}) with ${pct(odds.superCrit)}`}>
									<span className='inv-readout-label'>Crit</span>
									<span className='inv-readout-value'>{pct(odds.crit)}</span>
								</div>
								<div className='inv-readout' title={`HP per second: ${COMBAT.regenPerSec} base, ${gear.regen} from gear (gear regen also works in fights); ${gear.luck} Luck from gear`}>
									<span className='inv-readout-label'>Regen</span>
									<span className='inv-readout-value'>{Math.round((COMBAT.regenPerSec + gear.regen) * 10) / 10}/s</span>
								</div>
							</div>
							<div className='inv-abilities'>
								<ItemSlot locked label={ABILITY_HINT} />
								<ItemSlot locked label={ABILITY_HINT} />
							</div>
						</div>
						{gearSlot('offHand')}
					</div>

					<div className='flex justify-center gap-3 mt-4'>
						<button className='px-btn px-btn-sm' onClick={openClassDialog}>
							Class
						</button>
						<button
							className='px-btn px-btn-sm'
							onClick={() => setMenuTab('stats')}>
							Stats
						</button>
					</div>
				</div>

				{/* Bag */}
				<div className='px-panel flex-1 min-w-[360px] overflow-y-auto relative'>
					<div className='px-h text-center'>Items Bag</div>
					<Bag onNotice={setNotice} />
					<div className='px-tip-muted text-xs text-center mt-3'>
						Double-click to equip or drink, right-click for more. Drag to rearrange.
					</div>
					{notice && (
						<div className='px-toast absolute left-1/2 bottom-3 -translate-x-1/2 px-3 py-1 text-sm text-[#f0d27a] whitespace-nowrap'>
							{notice}
						</div>
					)}
				</div>
		</div>
	);
};

export default CharacterOverlay;
