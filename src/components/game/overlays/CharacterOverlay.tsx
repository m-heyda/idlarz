import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { COMBAT } from '@/config/combatConfig';
import { EQUIPMENT_LAYOUT, EQUIPMENT_SLOT_LABEL } from '@/config/itemCatalog';
import { MERCHANT_GOODS } from '@/config/gameConfig';
import { SKILLS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { armorOf, armorReduction, critOdds, damagePerClick, maxHp } from '@/lib/combat';
import { healAmount } from '@/lib/skills';
import { aggregateStats, averageItemLevel } from '@/lib/inventory';
import { effectiveStats } from '@/lib/effectiveStats';
import { clearDrag, getDrag, setDrag } from '@/lib/inventoryDrag';
import type { EquipmentSlot } from '@/types/game';
import { LevelBar } from '../LevelDetails';
import ItemSlot from '../ItemSlot';
import Bag from '../Bag';

// Armor and jewelry in two small grids, the weapon and the shield beside them: 13 slots, no hero scene (that lives in the Character tab)
const ARMOR_SLOTS = EQUIPMENT_LAYOUT.left;
const JEWELRY_SLOTS = EQUIPMENT_LAYOUT.right;

const CharacterOverlay: React.FC = () => {
	const setMenuTab = useUiStore((state) => state.setMenuTab);
	const equipment = useGameStore((state) => state.equipment);
	const characterStats = useGameStore((state) => state.characterStats);
	const equipItem = useGameStore((state) => state.equipItem);
	const prestige = useGameStore((state) => state.prestige);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const castSkill = useGameStore((state) => state.castSkill);
	const skillCd = useGameStore((state) => state.skillCd);
	const level = useGameStore((state) => state.level.level);
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
			item={equipment[slot]}
			equipped
			draggable
			onClick={() => takeOff(slot)}
			onDragStart={() => setDrag({ kind: 'equip', slot })}
			onDrop={dropOnSlot}
		/>
	);

	const armor = Math.round(armorOf(equipment, characterStats) * 10) / 10;
	const mitigation = Math.round(armorReduction(armor) * 100);
	const odds = critOdds(characterStats, equipment);
	const gear = aggregateStats(equipment);
	const fx = effectiveStats({ characterStats, equipment, prestige, merchantUpgrades });
	const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
	const worn = Object.values(equipment).filter(Boolean).length;
	const itemLevel = Math.round(averageItemLevel(equipment) * 10) / 10;

	return (
		<div className='flex gap-5 h-full'>
			{/* The worn gear: level and XP on top, then the item level, the slots, the numbers and the skills */}
			<div className='px-panel overflow-y-auto shrink-0 eq-panel'>
				<LevelBar />

				<div
					className='eq-ilvl'
					title={`The average item level of the ${worn} piece${worn === 1 ? '' : 's'} you wear. The merchant's goods are never more than ${MERCHANT_GOODS.maxAboveAverage} levels above it.`}>
					<span className='eq-ilvl-label'>Item level</span>
					<span className='eq-ilvl-value'>{itemLevel}</span>
				</div>

				<div className='eq-groups'>
					<div className='eq-group'>
						<div className='eq-group-title'>Armor</div>
						<div className='eq-grid'>{ARMOR_SLOTS.map(gearSlot)}</div>
					</div>
					<div className='eq-group'>
						<div className='eq-group-title'>Jewelry</div>
						<div className='eq-grid'>{JEWELRY_SLOTS.map(gearSlot)}</div>
					</div>
					<div className='eq-group'>
						<div className='eq-group-title'>Hands</div>
						<div className='eq-grid eq-grid-hands'>{EQUIPMENT_LAYOUT.bottom.map(gearSlot)}</div>
					</div>
				</div>

				<div className='inv-readouts eq-readouts'>
					<div className='inv-readout'>
						<span className='inv-readout-label'>Damage</span>
						<span className='inv-readout-value'>{damagePerClick(equipment, characterStats)}</span>
					</div>
					<div className='inv-readout' title={`${mitigation}% less damage taken (armor has diminishing returns past ${Math.round(COMBAT.armorSoftCap * 100)}% and never gives more than 75%)`}>
						<span className='inv-readout-label'>Armor</span>
						<span className='inv-readout-value'>{armor}</span>
					</div>
					<div className='inv-readout'>
						<span className='inv-readout-label'>Max HP</span>
						<span className='inv-readout-value'>{maxHp(characterStats, equipment)}</span>
					</div>
					<div className='inv-readout' title={`Chance that a click crits (x${fx.critMultiplier.toFixed(2)}); a crit becomes a super crit (x${fx.superCritMultiplier.toFixed(2)}) ${pct(odds.superCrit)} of the time`}>
						<span className='inv-readout-label'>Crit</span>
						<span className='inv-readout-value'>{pct(odds.crit)}</span>
					</div>
					<div className='inv-readout' title={`HP per second: ${COMBAT.regenPerSec} base, ${gear.regen} from gear (gear regen also works in fights); ${gear.luck} Luck from gear`}>
						<span className='inv-readout-label'>Regen</span>
						<span className='inv-readout-value'>{Math.round((COMBAT.regenPerSec + gear.regen) * 10) / 10}/s</span>
					</div>
				</div>

				<div className='inv-abilities eq-abilities'>
					{SKILL_IDS.map((id) => {
						const skill = SKILLS[id];
						const locked = level < skill.unlockLevel;
						const cd = Math.ceil(skillCd[id] ?? 0);
						const detail = locked
							? `Unlocks at level ${skill.unlockLevel}`
							: `${skill.manaCost} mana, ${skill.cooldownSec} s cooldown${id === 'heal' ? `, heals about ${healAmount(characterStats, equipment, skill)} HP` : ''}`;
						return (
							<button
								key={id}
								className='inv-ability'
								data-locked={locked}
								disabled={locked || skill.fightOnly}
								onClick={() => castSkill(id)}
								title={`${skill.name}: ${skillDescription(skill)} (${detail})`}>
								<span className='inv-ability-name'>{skill.name}</span>
								<span className='inv-ability-sub'>{locked ? `Lv ${skill.unlockLevel}` : cd > 0 ? `${cd} s` : `${skill.manaCost} MP`}</span>
							</button>
						);
					})}
				</div>

				<div className='flex justify-center gap-3 mt-4'>
					<button className='px-btn px-btn-sm' onClick={openClassDialog}>
						Class
					</button>
					<button className='px-btn px-btn-sm' onClick={() => setMenuTab('stats')}>
						Character
					</button>
				</div>
			</div>

			{/* Bag */}
			<div className='px-panel flex-1 min-w-[360px] overflow-y-auto relative'>
				<div className='px-h text-center'>Items Bag</div>
				<Bag onNotice={setNotice} />
				<div className='px-tip-muted text-xs text-center mt-3'>
					Double-click to equip or drink, right-click for more. Drag to rearrange, or press Organize.
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
