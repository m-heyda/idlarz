import React, { useMemo } from 'react';
import { Dock, HoverTip, IconButton } from '../../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../../packages/design-system/src/components/tooltips';
import { pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { useMenuAttention } from '@/hooks/useMenuAttention';
import { guideLive } from '@/lib/tutorial/live';
import { useAchievementStore } from '@/stores/achievementStore';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { useWindowStore, type WinId } from '@/stores/windowStore';
import CharacterPortrait from '../CharacterPortrait';
import { rebirthStatus } from '@/utils/game/rebirth';
import { farmHasPurchase } from '@/utils/game/farm';

const icon = (name: PixelIconName) => pixelIconSrc(name);

/** The windows in the dock, in order. The stone tiles are the ones the game already had (IDL-326 reworks them); Farm and Crafting keep their buttons until the Hero window takes over crafting. */
const WINDOWS: { id: WinId; label: string; icon: PixelIconName; tutorial: string }[] = [
	{ id: 'equipment', label: 'Equip', icon: 'menu_equipment', tutorial: 'tab-equipment' },
	{ id: 'merchant', label: 'Merchant', icon: 'menu_merchant', tutorial: 'tab-merchant' },
	{ id: 'farm', label: 'Farm', icon: 'menu_farm', tutorial: 'tab-farm' },
	{ id: 'crafting', label: 'Crafting', icon: 'menu_crafting', tutorial: 'tab-crafting' },
];

/**
 * The stone dock along the bottom of the screen (design system `Dock`): one icon per game window (open ones glow, one press opens or, on the front window, closes it) and Rebirth (dimmed until a rebirth is possible, its tooltip lists what is missing). A number on an icon says how much waits there: farm purchases, claimable deeds.
 */
const HudDock: React.FC = () => {
	const order = useWindowStore((state) => state.order);
	const level = useGameStore((state) => state.level.level);
	const points = useGameStore((state) => state.characterStats.availablePoints);
	const gemShopOpen = useUiStore((state) => state.gemShopOpen);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const { stats: pointsWaiting } = useMenuAttention();
	const toggleWindow = useWindowStore((state) => state.toggleWindow);
	const farmWaiting = useGameStore((state) => farmHasPurchase(state.resources, state.farmLevels, state.farmUpgrades));
	const claimable = useAchievementStore((state) => state.earned.filter((id) => !state.claimed.includes(id)).length);

	const rebirthOpen = useUiStore((state) => state.rebirthOpen);
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);
	const tiles = useGameStore((state) => state.tiles);
	const freeTiles = useGameStore((state) => state.freeTiles);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const prestige = useGameStore((state) => state.prestige);
	// recomputed when the map, a castle upgrade or the merchant changes, not on every income tick
	const status = useMemo(
		() => rebirthStatus({ tiles, freeTiles, castleUpgrade, merchantUpgrades, prestige }),
		[tiles, freeTiles, castleUpgrade, merchantUpgrades, prestige],
	);
	const missing = status.requirements.filter((r) => !r.met).map((r) => r.label);

	const waiting: Partial<Record<WinId, number>> = { farm: farmWaiting ? 1 : 0, achievements: claimable };

	return (
		<div data-hud-dock style={{ position: 'fixed', left: '50%', bottom: 6, transform: 'translateX(-50%)', zIndex: 39 }}>
			<div className='ds-root'>
				<Dock>
					{/* the hero's portrait opens the character screen; the badge counts unspent stat points. No tooltip */}
					<IconButton
						icon=''
						art={<CharacterPortrait variant='bust' scale={1.25} />}
						label={`Lv ${level}`}
						aria-label={`Character, level ${level}`}
						badge={pointsWaiting ? points : undefined}
						active={order.includes('character')}
						aria-pressed={order.includes('character')}
						data-tutorial='tab-character'
						onClick={() => toggleWindow('character')}
					/>
					{WINDOWS.map(({ id, label, icon: name, tutorial }) => (
						<IconButton
							key={id}
							icon={icon(name)}
							label={label}
							badge={waiting[id]}
							active={order.includes(id)}
							aria-pressed={order.includes(id)}
							data-tutorial={tutorial}
							onClick={() => toggleWindow(id)}
						/>
					))}
					<IconButton icon={icon('menu_gems_pouch')} label='Gems' active={gemShopOpen} aria-pressed={gemShopOpen} title='Gem shop' onClick={toggleGemShop} />
					{guideLive() && (
						<IconButton
							icon={icon('menu_achievements')}
							label='Deeds'
							badge={claimable}
							active={order.includes('achievements')}
							aria-pressed={order.includes('achievements')}
							data-tutorial='tab-achievements'
							onClick={() => toggleWindow('achievements')}
						/>
					)}
					<HoverTip
						placement='above'
						align='center'
						tip={
							<HintTooltip
								title='Rebirth'
								text={status.canRebirth ? 'Ready: start over for a permanent bonus.' : `Locked until: ${missing.join(', ')}`}
								tone={status.canRebirth ? 'normal' : 'bad'}
							/>
						}
					>
						<IconButton
							icon={icon('menu_legacy')}
							label='Rebirth'
							active={rebirthOpen}
							aria-pressed={rebirthOpen}
							aria-disabled={!status.canRebirth}
							data-tutorial='rebirth-button'
							onClick={() => (status.canRebirth || rebirthOpen) && toggleRebirth()}
						/>
					</HoverTip>
				</Dock>
			</div>
		</div>
	);
};

export default HudDock;
