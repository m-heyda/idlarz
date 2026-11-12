import React, { useEffect, useMemo, useState } from 'react';
import { AddSlot, Button, Divider, HoverTip, Inset, Panel, ProgressBar, Slot, Stat, Tabs } from '../../../../packages/design-system/src/components/primitives';
import { CraftStash, EquipGroup, HeroIdentity, XpBar, type StashEntry } from '../../../../packages/design-system/src/components/composites';
import { HintTooltip, TipRows, Tooltip } from '../../../../packages/design-system/src/components/tooltips';
import { compact, toRarity } from '../../../../packages/design-system/src/logic';
import { EQUIPMENT_LAYOUT, EQUIPMENT_SLOT_LABEL, ITEM_CATALOG } from '@/catalog';
import { avatarArtUrl, resolveAvatar } from '@/catalog/avatars';
import { shownBadge, shownTitle } from '@/catalog/badges';
import { COMPONENTS } from '@/catalog/recipes';
import { SKILLS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { COMBAT } from '@/config/combatConfig';
import { MERCHANT_GOODS, MERCHANT_UPGRADES } from '@/config/merchant';
import { MAX_LEVEL } from '@/config/character';
import { EQUIPMENT_PIXEL_ICONS, pixelIconSrc } from '@/config/pixelIcons';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import { armorReduction, maxHp, maxMana } from '@/lib/combat';
import { describeClassPassives } from '@/lib/classPassives';
import { effectiveStats } from '@/lib/effectiveStats';
import { idolEconomy } from '@/lib/idolEconomy';
import { aggregateStats, averageItemLevel, gearOf } from '@/lib/inventory';
import { setDrag } from '@/lib/inventoryDrag';
import { resolveItem } from '@/lib/itemInstance';
import { countJunk, isJunk, junkFor, wornLevelOf } from '@/lib/loot/junk';
import { healAmount } from '@/lib/skills';
import { useGameStore } from '@/stores/gameStore';
import { selectStock, useCraftStore } from '@/stores/craftStore';
import { useUiStore } from '@/stores/uiStore';
import type { BagSlot, EquipmentSlot, ItemInstance } from '@/types/game';
import { formatCompact, formatNumber, formatPct } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/game/merchant';
import { xpToNextLevel } from '@/utils/game/character';
import { useBadgeChoice } from '../BadgeDialog';
import BuffRow from '../BuffRow';
import { itemIconName, slotProps } from '../itemUi';
import { LevelUpTimer } from '../LevelUpTimer';
import GameWindow from '../GameWindow';
import { activateBagSlot, dropOnBagSlot, dropOnEquipment, openBagMenu, shiftSellBagSlot, takeOffSlot } from './bagActions';
import { GameItemTip } from './GameItemTip';
import HeroCrafting, { CraftingSidebar } from './HeroCrafting';
import HeroStats from './HeroStats';

/** A bag slot as the design system draws it: the picture, the rarity glow and the stack count of the item in it. */
const slotLook = (slot: BagSlot | ItemInstance | null | undefined, instance?: ItemInstance | null) => {
	const gear = instance ?? (slot && typeof slot === 'object' && 'item' in slot ? slot.item : null);
	const resolved = gear ? resolveItem(gear) : null;
	const id = slot && typeof slot === 'object' && 'id' in slot ? slot.id : undefined;
	const def = resolved?.def ?? (id ? ITEM_CATALOG[id] : undefined);
	if (!def) return null;
	return {
		def,
		name: resolved?.name ?? def.name,
		icon: pixelIconSrc(itemIconName(def)),
		rarity: toRarity(String(resolved?.instance.rarity ?? def.rarity ?? 'common')),
	};
};

/** One worn piece or the empty silhouette of its slot, with the hover card and the old drag, drop and click-to-take-off behaviour. */
const WornSlot: React.FC<{ slot: EquipmentSlot; wornLevel: number }> = ({ slot }) => {
	const item = useGameStore((state) => state.equipment[slot]);
	const look = item ? slotLook(null, item) : null;
	const label = slot === 'ring1' || slot === 'ring2' ? 'Ring' : EQUIPMENT_SLOT_LABEL[slot];
	const button = (
		<Slot
			icon={look?.icon ?? pixelIconSrc(EQUIPMENT_PIXEL_ICONS[slot])}
			empty={!look}
			rarity={look?.rarity}
			aria-label={look?.name ?? `Empty ${label} slot`}
			draggable={!!look}
			onClick={() => takeOffSlot(slot)}
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = 'move';
				setDrag({ kind: 'equip', slot });
			}}
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				e.preventDefault();
				dropOnEquipment();
			}}
		/>
	);
	return (
		<HoverTip
			interactive
			closeDelayMs={100}
			tip={item ? <GameItemTip item={item} /> : <HintTooltip title={label} text='Empty slot: double-click a piece in the bag to wear it, or drag it here' />}
		>
			{button}
		</HoverTip>
	);
};

/** A skill button: click casts it (the server decides), shows its mana cost, cooldown or the level it unlocks at. */
const SkillSlot: React.FC<{ id: (typeof SKILL_IDS)[number] }> = ({ id }) => {
	const characterStats = useGameStore((state) => state.characterStats);
	const equipment = useGameStore((state) => state.equipment);
	const playerClass = useGameStore((state) => state.playerClass);
	const level = useGameStore((state) => state.level.level);
	const cd = Math.ceil(useGameStore((state) => state.combat.cd[id] ?? 0));
	const requestSkill = useGameStore((state) => state.requestSkill);
	const skill = SKILLS[id];
	const locked = level < skill.unlockLevel;
	const detail = locked
		? `Unlocks at level ${skill.unlockLevel}`
		: `${skill.manaCost} mana, ${skill.cooldownSec} s cooldown${id === 'heal' ? `, heals about ${formatCompact(healAmount(characterStats, equipment, skill, playerClass))} HP` : ''}`;
	return (
		<HoverTip tip={<HintTooltip title={skill.name} text={`${skillDescription(skill)} (${detail})`} />}>
			<Slot
				label={skill.name}
				sub={locked ? `Lv ${skill.unlockLevel}` : cd > 0 ? `${cd} s` : `${skill.manaCost} MP`}
				locked={locked}
				disabled={locked || skill.fightOnly}
				onClick={() => requestSkill(id)}
			/>
		</HoverTip>
	);
};

/**
 * The left column: who the hero is (avatar, name, title, badge, class: each opens its picker), level and XP, HP and MP, the worn gear in groups, the skills and the four headline numbers. Every number and tooltip of the old Equipment
 * window is here: the XP rate and time to the next level on the XP bar, max HP and regen on the HP bar, the armor mitigation, the crit multipliers, the average item level, the class passives on the class line.
 */
const HeroLeft: React.FC = () => {
	const playerName = useGameStore((state) => state.playerName);
	const playerClass = useGameStore((state) => state.playerClass);
	const level = useGameStore((state) => state.level);
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const characterStats = useGameStore((state) => state.characterStats);
	const equipment = useGameStore((state) => state.equipment);
	const prestige = useGameStore((state) => state.prestige);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const tiles = useGameStore((state) => state.tiles);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const playerHp = useGameStore((state) => state.playerHp);
	const playerMp = useGameStore((state) => state.playerMp);
	const avatarId = useUiStore((state) => state.avatarId);
	const choice = useUiStore((state) => state.badge);
	const openAvatarDialog = useUiStore((state) => state.openAvatarDialog);
	const openBadgeDialog = useUiStore((state) => state.openBadgeDialog);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	useBadgeChoice();

	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];
	const badge = shownBadge(choice.badgeId, choice.earned);
	const title = shownTitle(choice.titleId, choice.earned);
	const passives = describeClassPassives(playerClass);

	const idol = idolEconomy(tiles, idolLevels);
	const fx = effectiveStats({ characterStats, equipment, prestige, merchantUpgrades, playerClass, idol });
	const gear = aggregateStats(equipment);
	const hpMax = maxHp(characterStats, equipment);
	const mpMax = maxMana(characterStats, equipment, playerClass);
	const mitigation = armorReduction(fx.armor) * 100;
	const worn = Object.values(equipment).filter(Boolean).length;
	const itemLevel = Math.round(averageItemLevel(equipment) * 10) / 10;
	const wornLevel = wornLevelOf(equipment);

	const needed = level.level >= MAX_LEVEL ? 0 : xpToNextLevel(level.level);
	const into = Math.floor(level.progress * needed);
	const xpText =
		needed > 0 ? `Level ${level.level} · ${Math.floor(level.progress * 100)}% · ${compact(into)} / ${compact(needed)}` : `Level ${level.level} · MAX`;

	return (
		<Panel className='ds-hero-left'>
			<HeroIdentity
				avatar={avatarArtUrl(resolveAvatar(avatarId, playerClass))}
				name={playerName}
				classLabel={`${info.race} ${info.label}`}
				badge={badge ? `/pixel/new_assets/achievements/${badge.badge}.png` : undefined}
				title={title}
				onAvatar={openAvatarDialog}
				onBadge={openBadgeDialog}
				onClass={openClassDialog}
				avatarTitle='Change avatar'
				classTitle={`Change class. ${[...passives.combat, ...passives.economy].join(', ')}`}
			/>
			<Divider />
			<div className='ds-eq-bars'>
				<HoverTip
					fill
					tip={
						<Tooltip title='Experience'>
							<LevelUpTimer resourceRates={resourceRates} resources={resources} level={level} />
						</Tooltip>
					}
				>
					<XpBar level={level.level} value={needed > 0 ? into : 1} max={needed > 0 ? needed : 1} label={xpText} />
				</HoverTip>
				<HoverTip
					fill
					tip={
						<Tooltip title='Health'>
							<TipRows
								rows={[
									{ label: 'Max HP', value: formatCompact(fx.maxHp) },
									{ label: 'Regen out of fights', value: `${formatCompact(fx.hpRegen)}/s` },
									{ label: 'Regen in a fight', value: `${formatCompact(fx.hpRegen - COMBAT.regenPerSec)}/s` },
									{ label: 'Regen from gear', value: `${formatCompact(gear.regen)}/s` },
									{ label: 'Luck from gear', value: formatCompact(gear.luck) },
								]}
							/>
						</Tooltip>
					}
				>
					<ProgressBar value={Math.floor(playerHp)} max={hpMax} label={`HP ${formatCompact(Math.floor(playerHp))} / ${formatCompact(hpMax)}`} />
				</HoverTip>
				<ProgressBar value={Math.floor(playerMp)} max={mpMax} tone='mana' label={`MP ${formatCompact(Math.floor(playerMp))} / ${formatCompact(mpMax)}`} />
			</div>
			<div className='ds-equip'>
				<EquipGroup title='Armor' cols={6} gap={3}>
					{EQUIPMENT_LAYOUT.left.map((slot) => (
						<WornSlot key={slot} slot={slot} wornLevel={wornLevel} />
					))}
				</EquipGroup>
				<EquipGroup title='Jewelry' cols={6} gap={3}>
					{EQUIPMENT_LAYOUT.right.map((slot) => (
						<WornSlot key={slot} slot={slot} wornLevel={wornLevel} />
					))}
				</EquipGroup>
				<EquipGroup title='Hands' cols={2} gap={8}>
					{EQUIPMENT_LAYOUT.bottom.map((slot) => (
						<WornSlot key={slot} slot={slot} wornLevel={wornLevel} />
					))}
				</EquipGroup>
				<EquipGroup title='Skills' cols={2} gap={8}>
					{SKILL_IDS.map((id) => (
						<SkillSlot key={id} id={id} />
					))}
				</EquipGroup>
			</div>
			<Inset style={{ display: 'flex', justifyContent: 'space-around' }}>
				<HoverTip tip={<HintTooltip title='Damage' text='Damage of one hit with your weapon, attributes and bonuses' />}>
					<Stat label='Damage' value={formatCompact(fx.damage)} tone='damage' />
				</HoverTip>
				<HoverTip
					tip={
						<HintTooltip
							title='Armor'
							text={`${formatPct(mitigation, 0)} less damage taken (armor has diminishing returns past ${Math.round(COMBAT.armorSoftCap * 100)}% and never gives more than 75%)`}
						/>
					}
				>
					<Stat label='Armor' value={formatCompact(fx.armor)} tone='armor' />
				</HoverTip>
				<HoverTip
					tip={
						<HintTooltip
							title='Crit'
							text={`Chance that a hit crits (x${formatCompact(fx.critMultiplier, 2)}); a crit becomes a super crit (x${formatCompact(fx.superCritMultiplier, 2)}) ${formatPct(fx.superCritChance)} of the time`}
						/>
					}
				>
					<Stat label='Crit' value={formatPct(fx.critChance)} />
				</HoverTip>
				<HoverTip
					tip={
						<HintTooltip
							title='Item level'
							text={`The average item level of the ${worn} piece${worn === 1 ? '' : 's'} you wear. The merchant's goods are never more than ${MERCHANT_GOODS.maxAboveAverage} levels above it.`}
						/>
					}
				>
					<Stat label='Item lvl' value={formatCompact(itemLevel)} />
				</HoverTip>
			</Inset>
		</Panel>
	);
};

/** One slot of the bag: the item with its hover card (compared with what is worn), double-click, shift-click, right-click and drag, or an empty slot that takes drops. */
const BagCell: React.FC<{ slot: BagSlot; index: number; wornLevel: number }> = ({ slot, index, wornLevel }) => {
	const look = slotLook(slot);
	const props = slotProps(slot);
	if (!look) return <Slot onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), dropOnBagSlot(index))} />;
	const junk = !!props.item && isJunk(props.item, { wornLevel });
	return (
		<HoverTip
			interactive
			closeDelayMs={100}
			tip={<GameItemTip item={props.item} itemId={props.itemId} compare hints='bag' />}
		>
			<Slot
				icon={look.icon}
				rarity={look.rarity}
				count={props.qty}
				junk={junk}
				aria-label={look.name}
				draggable
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = 'move';
					setDrag({ kind: 'bag', index });
				}}
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => (e.preventDefault(), dropOnBagSlot(index))}
				onClick={(e) => e.shiftKey && shiftSellBagSlot(index)}
				onDoubleClick={() => activateBagSlot(index)}
				onContextMenu={(e) => (e.preventDefault(), openBagMenu(index, e))}
			/>
		</HoverTip>
	);
};

/** The shortcut at the end of the bag: what more space costs (the Pack Rat upgrade of the Merchant) and a click that opens the Merchant on it. */
const MoreSpace: React.FC = () => {
	const upgrades = useGameStore((state) => state.merchantUpgrades);
	const openMerchantOn = useUiStore((state) => state.openMerchantOn);
	const def = MERCHANT_UPGRADES.packrat;
	const level = merchantLevel(upgrades, 'packrat');
	const maxed = level >= def.maxLevel;
	return (
		<AddSlot
			onClick={() => openMerchantOn('gold')}
			tip={
				<Tooltip className='ds-tip-compact' title='More bag space' icon={pixelIconSrc('menu_bag_scroll')} subtitle='Merchant upgrade: Pack Rat'>
					{maxed ? (
						<TipRows rows={[{ label: 'Pack Rat', value: 'Fully upgraded' }]} />
					) : (
						<TipRows
							rows={[
								{ label: 'Next level', value: `+${def.effectPerLevel} slots` },
								{ label: 'Cost', value: <span className='ds-gold-text'>{compact(merchantUpgradeCost('packrat', level))} gold</span> },
							]}
						/>
					)}
				</Tooltip>
			}
		/>
	);
};

/** The crafting bag: what crafting made, kept on the server; potions and goods are taken into the bag. */
const CraftingBag: React.FC = () => {
	const stock = useCraftStore(selectStock);
	const withdraw = useCraftStore((state) => state.withdraw);
	const refresh = useCraftStore((state) => state.refresh);
	const showToast = useUiStore((state) => state.showToast);
	useEffect(() => void refresh(), [refresh]);
	const entries: StashEntry[] = useMemo(
		() =>
			Object.entries(stock)
				.filter(([, qty]) => qty > 0)
				.map(([id, qty]) => {
					const item = ITEM_CATALOG[id];
					return {
						id,
						qty,
						name: item?.name ?? COMPONENTS[id]?.name ?? id,
						icon: pixelIconSrc(item ? itemIconName(item) : 'comp_glass_vial'),
						kind: item ? (item.kind === 'consumable' || item.effects?.length ? ('potion' as const) : ('good' as const)) : ('component' as const),
						stack: item?.stackMax ?? 1,
					};
				}),
		[stock],
	);
	return (
		<Inset className='ds-stash-wrap'>
			<CraftStash entries={entries} onTake={(id, n) => void withdraw(id, n).then(showToast)} />
		</Inset>
	);
};

/** The Bag tab: the bag and the crafting bag as sub-tabs, the slot grid with buffs above it, the used count, Organise, Sell junk and the hint line. */
const BagTab: React.FC = () => {
	const bag = useGameStore((state) => state.bag);
	const equipment = useGameStore((state) => state.equipment);
	const fighting = useGameStore((state) => !!state.combat.fight);
	const organizeBag = useGameStore((state) => state.organizeBag);
	const sellJunk = useGameStore((state) => state.sellJunk);
	const showToast = useUiStore((state) => state.showToast);
	const [view, setView] = useState<'bag' | 'craft'>('bag');
	const wornLevel = wornLevelOf(equipment);
	const junkCount = countJunk(bag, junkFor(equipment));
	const used = bag.filter(Boolean).length;
	const gearCount = bag.reduce((n, slot) => n + (gearOf(slot) ? 1 : 0), 0);

	return (
		<>
			<div className='ds-subtabs' role='tablist'>
				<button type='button' role='tab' aria-selected={view === 'bag'} data-active={view === 'bag'} onClick={() => setView('bag')}>
					Bag
				</button>
				<button type='button' role='tab' aria-selected={view === 'craft'} data-active={view === 'craft'} onClick={() => setView('craft')}>
					Crafting bag
				</button>
			</div>
			{view === 'craft' ? (
				<CraftingBag />
			) : (
				<>
					<BuffRow />
					<Inset className='ds-baggrid'>
						{bag.map((slot, i) => (
							<BagCell key={i} slot={slot} index={i} wornLevel={wornLevel} />
						))}
						<MoreSpace />
					</Inset>
					<div className='ds-bag-foot'>
						<span className='ds-dim'>
							{used} of {bag.length} slots used
						</span>
						<span className='ds-bag-actions'>
							<HoverTip tip={<HintTooltip title='Organise' text='Merge stacks and sort the bag: potions first, then gear by slot, rarity and level' />}>
								<Button onClick={() => !organizeBag() && showToast('Finish the fight first')}>Organise</Button>
							</HoverTip>
							<HoverTip
								tip={
									<HintTooltip
										title={junkCount > 0 ? `Sell ${formatNumber(junkCount)} junk` : 'No junk yet'}
										text={
											junkCount > 0
												? 'Junk materials and the gear marked as junk or well below what you wear. Mark gear from its right-click menu.'
												: `Right-click a piece of gear and mark it as junk, or wait for pieces ${gearCount > 0 ? 'well below what you wear' : 'to drop'}.`
										}
									/>
								}
							>
								<Button
									tone='danger'
									disabled={fighting || junkCount === 0}
									onClick={() => {
										const { gold, count } = sellJunk();
										showToast(count > 0 ? `Sold ${formatNumber(count)} junk item${count === 1 ? '' : 's'} for ${formatNumber(gold)} Gold` : 'No junk to sell');
									}}
								>
									Sell junk{junkCount > 0 ? ` (${formatNumber(junkCount)})` : ''}
								</Button>
							</HoverTip>
						</span>
						<span className='ds-dim ds-bag-hint'>Dbl-click equips or drinks, right-click for more. Drag to rearrange.</span>
					</div>
				</>
			)}
		</>
	);
};

type HeroTab = 'bag' | 'stats' | 'craft';

/**
 * The Hero window (design system `WindowShell`, window id `equipment`): Bag, Stats and Crafting tabs. The hero card and the worn gear are always on the left; the Bag tab is the full new bag. Stats and Crafting are the new tabs. A click on the avatar in the dock opens it on the Bag tab.
 */
const HeroWindow: React.FC = () => {
	const [tab, setTab] = useState<HeroTab>('bag');
	const points = useGameStore((state) => state.characterStats.availablePoints);
	return (
		<GameWindow
			id='equipment'
			title='Hero'
			width={1100}
			height={760}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as HeroTab)}
					items={[
						{ id: 'bag', label: 'Bag' },
						{ id: 'stats', label: 'Stats', badge: points > 0 ? points : undefined, anchor: tab === 'stats' ? undefined : 'stat-add' },
						{ id: 'craft', label: 'Crafting' },
					]}
				/>
			}
		>
			<div className='ds-hero' data-tab={tab}>
				{tab === 'craft' ? <CraftingSidebar /> : <HeroLeft />}
				<Panel className='ds-hero-right'>{tab === 'bag' ? <BagTab /> : tab === 'stats' ? <HeroStats /> : <HeroCrafting />}</Panel>
			</div>
		</GameWindow>
	);
};

export default HeroWindow;
