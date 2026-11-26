import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import GameModal from '../GameModal';
import { nickColorValue } from '@/config/nickColors';
import {
	AddSlot,
	Button,
	DiamondLevel,
	Divider,
	HoverTip,
	Inset,
	Panel,
	ProgressBar,
	Slot,
	Stat,
	Tabs,
} from '../../../../packages/design-system/src/components/primitives';
import { ComingSoon, EquipGroup, HeroIdentity, XpBar, type StashEntry } from '../../../../packages/design-system/src/components/composites';
import { HintTooltip, TipLine, TipRows, Tooltip } from '../../../../packages/design-system/src/components/tooltips';
import { xpBarOf } from '@/lib/xpBar';
import { compact, toRarity } from '../../../../packages/design-system/src/logic';
import { EQUIPMENT_LAYOUT, EQUIPMENT_SLOT_LABEL, ITEM_CATALOG } from '@/catalog';
import { avatarArtUrl, resolveAvatar } from '@/catalog/avatars';
import { badgePicSrc, shownBadge, shownTitle } from '@/catalog/badges';
import { INGREDIENT_BY_ID } from '@/catalog/ingredients';
import { COMPONENTS } from '@/catalog/recipes';
import { SKILLS, SKILL_ICONS, SKILL_IDS, skillDescription } from '@/catalog/skills';
import { COMBAT } from '@/config/combatConfig';
import { MERCHANT_GOODS, MERCHANT_UPGRADES } from '@/config/merchant';
import { EQUIPMENT_PIXEL_ICONS, pixelIconSrc } from '@/config/pixelIcons';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import { armorReduction, maxHp, maxMana } from '@/lib/combat';
import { describeClassPassives } from '@/lib/classPassives';
import { effectiveStats } from '@/lib/effectiveStats';
import { idolEconomy } from '@/lib/idolEconomy';
import { aggregateStats, averageItemLevel, gearOf } from '@/lib/inventory';
import { setDrag } from '@/lib/inventoryDrag';
import { openMenuAt } from '@/lib/globalMenu';
import { resolveItem } from '@/lib/itemInstance';
import { countJunk, isJunk, junkFor, junkGold, wornLevelOf } from '@/lib/loot/junk';
import { healAmount } from '@/lib/skills';
import { useGameStore } from '@/stores/gameStore';
import { selectStock, useCraftStore } from '@/stores/craftStore';
import { useUiStore } from '@/stores/uiStore';
import type { BagSlot, EquipmentSlot, ItemInstance } from '@/types/game';
import { formatCompact, formatNumber, formatPct } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/game/merchant';
import { useBadgeChoice } from '../BadgeDialog';
import BuffRow from '../BuffRow';
import { itemIconName, slotProps } from '../itemUi';
import { componentIconUrl } from './recipeUi';
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
				icon={SKILL_ICONS[id]}
				aria-label={skill.name}
				caption={locked ? `Lv ${skill.unlockLevel}` : cd > 0 ? `${cd} s` : `${skill.manaCost} MP`}
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

	const bar = xpBarOf(level, resources.xp);

	return (
		<Panel className='ds-hero-left'>
			<HeroIdentity
				avatar={avatarArtUrl(resolveAvatar(avatarId, playerClass))}
				name={playerName}
				classLabel={`${info.race} ${info.label}`}
				badge={badge ? badgePicSrc(badge.badge) : undefined}
				title={title}
				nameColor={nickColorValue(choice.nameColor)}
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
					<XpBar level={level.level} value={bar.into} max={bar.max} label={bar.label} />
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
		<HoverTip interactive closeDelayMs={100} tip={<GameItemTip item={props.item} itemId={props.itemId} compare hints='bag' />}>
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

/** The picture of "more bag space": a leather pouch from the spare icons. */
const BAG_ICON = '/pixel/ui/coin_pouch.png';

/** The end of the bag: a click buys the next Pack Rat level (more bag slots) with gold, and the tooltip shows the level as gems, what the next one gives and what it costs. */
const MoreSpace: React.FC = () => {
	const upgrades = useGameStore((state) => state.merchantUpgrades);
	const gold = useGameStore((state) => state.resources.gold);
	const buy = useGameStore((state) => state.buyMerchantUpgrade);
	const showToast = useUiStore((state) => state.showToast);
	const def = MERCHANT_UPGRADES.packrat2;
	const level = merchantLevel(upgrades, 'packrat2');
	const maxed = level >= def.maxLevel;
	const cost = merchantUpgradeCost('packrat2', level);
	const affordable = gold >= cost;
	const [asking, setAsking] = useState(false);
	const purchase = () => {
		setAsking(false);
		if (buy('packrat2')) showToast(`Purchased ${def.label} level ${level + 1} for ${compact(cost)} Gold`);
		else showToast('Not enough gold for more bag space');
	};
	return (
		<>
			{asking && (
				<GameModal title='Buy more bag space?' size='sm' onClose={() => setAsking(false)}>
					<p style={{ margin: '0 0 6px' }}>
						Pack Rat level {level + 1} adds <b>{def.effectPerLevel}</b> bag slots.
					</p>
					<p style={{ margin: '0 0 14px', color: affordable ? undefined : '#ff7a6a' }}>
						It costs {compact(cost)} gold{affordable ? '' : ` (you have ${compact(gold)})`}.
					</p>
					<div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
						<Button onClick={() => setAsking(false)}>Cancel</Button>
						<Button tone='gold' disabled={!affordable} onClick={purchase}>
							Buy
						</Button>
					</div>
				</GameModal>
			)}
			<AddSlot
				onClick={() => {
					if (!maxed) setAsking(true);
				}}
				tip={
					<Tooltip className='ds-tip-compact' title='More bag space' icon={BAG_ICON} subtitle={`Pack Rat · level ${level} of ${def.maxLevel}`}>
						<div style={{ padding: '6px 0 2px' }}>
							<DiamondLevel level={level} max={def.maxLevel} small />
						</div>
						{maxed ? (
							<TipRows rows={[{ label: 'Pack Rat', value: 'Fully upgraded' }]} />
						) : (
							<TipRows
								rows={[
									{ label: 'Next level', value: `+${def.effectPerLevel} slots`, tone: 'green' },
									{ label: 'Cost', value: `${compact(cost)} gold`, tone: affordable ? 'gold' : 'red' },
								]}
							/>
						)}
						{maxed ? null : (
							<div className='ds-tip-keys'>
								<span>
									<span className='ds-kbd'>Click</span>buy
								</span>
							</div>
						)}
					</Tooltip>
				}
			/>
		</>
	);
};

/** Empty cells the crafting bag shows at least (it fills the window; more things add rows) */
const CRAFT_BAG_MIN_CELLS = 84;
const KIND_LABEL = { component: 'Component', potion: 'Potion', good: 'Trade good', special: 'Special item' } as const;

/**
 * The crafting bag: what crafting made and the components, kept on the server. It looks like the bag (a grid of slots, one per kind of thing, with the count in the corner) but has no slot limit: past the empty cells it just gets another row.
 * Things only move one way, out. A click opens the stack's actions (take a stack or all of a potion or trade good into the bag, or "Craft with it" for a component, which opens the Crafting tab searched by its name); Shift+click takes all that fits at once.
 * Nothing can be put back, and ingredients and components stay for recipes: they are tooltip-only and can never be sold or withdrawn (the server refuses, `applyWithdraw`). An ingredient's slot wears its tier colour (grey, green, blue, purple) and its tooltip says what uses it and where it drops.
 */
const TIER_RARITY = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic' } as const;
const CraftingBag: React.FC<{ onCraftWith: (query: string) => void }> = ({ onCraftWith }) => {
	const stock = useCraftStore(selectStock);
	const withdraw = useCraftStore((state) => state.withdraw);
	const refresh = useCraftStore((state) => state.refresh);
	const showToast = useUiStore((state) => state.showToast);
	useEffect(() => void refresh(), [refresh]);
	const entries: (StashEntry & { tier?: 1 | 2 | 3 | 4; about?: string })[] = useMemo(
		() =>
			Object.entries(stock)
				.filter(([, qty]) => qty > 0)
				.map(([id, qty]) => {
					const item = ITEM_CATALOG[id];
					return {
						id,
						qty,
						name: item?.name ?? COMPONENTS[id]?.name ?? id,
						icon: item ? pixelIconSrc(itemIconName(item)) : componentIconUrl(id),
						kind: item ? (item.kind === 'consumable' || item.effects?.length ? ('potion' as const) : ('good' as const)) : ('component' as const),
						stack: item?.stackMax ?? 1,
						tier: INGREDIENT_BY_ID.get(id)?.tier,
						about: item?.description ?? COMPONENTS[id]?.description,
					};
				}),
		[stock],
	);
	// the crafting bag has no slot limit: it always fills the window with empty cells, and past that the grid just gets another row
	const cells = Math.max(CRAFT_BAG_MIN_CELLS, entries.length);
	return (
		<Inset className='ds-baggrid ds-craftbag'>
			{entries.map((entry) => {
				const takeable = entry.kind !== 'component';
				const take = (n: number) => void withdraw(entry.id, Math.min(entry.qty, n)).then(showToast);
				const openActions = (e: React.MouseEvent) => {
					const items = takeable
						? [
								{
									id: 'take',
									label: `Take a stack${(entry.stack ?? 1) > 1 ? ` (${Math.min(entry.qty, entry.stack ?? 1)})` : ''}`,
									onSelect: () => take(entry.stack ?? 1),
								},
								{ id: 'takeAll', label: 'Take all that fits', onSelect: () => take(entry.qty) },
							]
						: [{ id: 'craft', label: 'Craft with it...', hint: 'opens Crafting', onSelect: () => onCraftWith(entry.name) }];
					openMenuAt(e.clientX, e.clientY, entry.name, items);
				};
				return (
					<HoverTip
						key={entry.id}
						tip={
							<Tooltip
								className='ds-tip-wide'
								rarity={entry.tier ? TIER_RARITY[entry.tier] : 'common'}
								title={entry.name}
								icon={entry.icon}
								subtitle={KIND_LABEL[entry.kind]}
							>
								{entry.about ? <TipLine>{entry.about}</TipLine> : null}
								<TipRows rows={[{ label: 'You hold', value: formatNumber(entry.qty) }]} />
								<div className='ds-tip-keys'>
									{takeable ? (
										<>
											<span>
												<span className='ds-kbd'>Click</span>take a stack
											</span>
											<span>
												<span className='ds-kbd'>Shift</span>+<span className='ds-kbd'>Click</span>take all
											</span>
										</>
									) : (
										<>
											<span>
												<span className='ds-kbd'>Click</span>craft with it
											</span>
											<span style={{ whiteSpace: 'normal' }}>Kept here for recipes: it cannot be sold or taken out</span>
										</>
									)}
								</div>
							</Tooltip>
						}
					>
						<Slot
							icon={entry.icon}
							rarity={entry.tier ? TIER_RARITY[entry.tier] : 'common'}
							count={entry.qty > 1 ? compact(entry.qty) : undefined}
							aria-label={entry.name}
							onClick={(e) => (takeable && e.shiftKey ? take(entry.qty) : openActions(e))}
						/>
					</HoverTip>
				);
			})}
			{Array.from({ length: cells - entries.length }, (_, i) => (
				<Slot key={`empty-${i}`} />
			))}
		</Inset>
	);
};

/** The Bag tab: the bag and the crafting bag as sub-tabs, the slot grid with buffs above it, the used count, Organise, Sell junk and the hint line. */
const BagTab: React.FC<{ onCraftWith: (query: string) => void }> = ({ onCraftWith }) => {
	const bag = useGameStore((state) => state.bag);
	const equipment = useGameStore((state) => state.equipment);
	const sellCtx = useGameStore(
		useShallow((state) => ({ merchantUpgrades: state.merchantUpgrades, prestige: state.prestige, tiles: state.tiles, idolLevels: state.idolLevels })),
	);
	const fighting = useGameStore((state) => !!state.combat.fight);
	const organizeBag = useGameStore((state) => state.organizeBag);
	const sellJunk = useGameStore((state) => state.sellJunk);
	const showToast = useUiStore((state) => state.showToast);
	const [view, setView] = useState<'bag' | 'craft'>('bag');
	const wornLevel = wornLevelOf(equipment);
	const junkCount = countJunk(bag, junkFor(equipment));
	const junkWorth = junkGold(bag, sellCtx, junkFor(equipment)); // the gold the button pays, shown on it
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
				<CraftingBag onCraftWith={onCraftWith} />
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
										title={junkCount > 0 ? `Sell ${formatNumber(junkCount)} junk for ${formatNumber(junkWorth)} Gold` : 'No junk yet'}
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
									Sell junk{junkCount > 0 ? ` (${formatCompact(junkWorth)} Gold)` : ''}
								</Button>
							</HoverTip>
						</span>
						<span className='ds-dim ds-bag-hint'>Dbl-click equips, drinks or opens, right-click for more. Drag to rearrange.</span>
					</div>
				</>
			)}
		</>
	);
};

type HeroTab = 'bag' | 'stats' | 'pets' | 'skills' | 'craft';

/** The Skills tab for now: a coming-soon screen (the two skills the hero has, Heal and Stun, are on the left under Skills). */
const SkillsSoon: React.FC = () => (
	<ComingSoon
		title='Skills'
		icon={SKILL_ICONS.heal}
		text='New abilities and a place to learn and upgrade them are on the way. Heal and Stun, on the left, are what you have for now.'
	/>
);

/** The Pets tab for now: a coming-soon screen (the pet system itself is not built yet). */
const PetsSoon: React.FC = () => (
	<ComingSoon
		title='Pets'
		icon={pixelIconSrc('eggs')}
		text='Hatch a companion and let it walk beside your hero. Pets are on the way: eggs, companions and what they can do.'
	/>
);

/**
 * The Hero window (design system `WindowShell`, window id `equipment`): Bag, Stats, Pets, Skills and Crafting tabs. The hero card and the worn gear are always on the left; the Bag tab is the full new bag. Stats and Crafting are the new tabs. A click on the avatar in the dock opens it on the Bag tab.
 */
const HeroWindow: React.FC = () => {
	const [tab, setTab] = useState<HeroTab>('bag');
	const [craftQuery, setCraftQuery] = useState('');
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
						{ id: 'pets', label: 'Pets' },
						{ id: 'skills', label: 'Skills' },
						{ id: 'craft', label: 'Crafting' },
					]}
				/>
			}
		>
			<div className='ds-hero' data-tab={tab}>
				{tab === 'craft' ? <CraftingSidebar /> : <HeroLeft />}
				<Panel className='ds-hero-right'>
					{tab === 'bag' ? (
						<BagTab
							onCraftWith={(query) => {
								setCraftQuery(query);
								setTab('craft');
							}}
						/>
					) : tab === 'stats' ? (
						<HeroStats />
					) : tab === 'pets' ? (
						<PetsSoon />
					) : tab === 'skills' ? (
						<SkillsSoon />
					) : (
						<HeroCrafting key={craftQuery} initialQuery={craftQuery} />
					)}
				</Panel>
			</div>
		</GameWindow>
	);
};

export default HeroWindow;
