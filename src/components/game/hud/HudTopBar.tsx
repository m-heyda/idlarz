import React from 'react';
import { ChipGroup, GlyphButton, TopBar } from '../../../../packages/design-system/src/components/primitives';
import { ResourceStat } from '../../../../packages/design-system/src/components/tooltips';
import { RESOURCES, RESOURCE_TIERS, resourcesInTier, type ResourceKey } from '@/catalog';
import { MERCHANT_RESOURCE_PRICES } from '@/config/merchant';
import { pixelIconSrc, type PixelIconName, RESOURCE_PIXEL_ICONS } from '@/config/pixelIcons';
import { resourceDiscovered } from '@/lib/resourceDiscovery';
import { openMenuAt } from '@/lib/globalMenu';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatHeaderAmount, formatPercent, formatRateAuto } from '@/utils/formatters';

const exactOf = (n: number) => Math.floor(n).toLocaleString('en-US');

/** The picture of a resource for the design-system chip (a resource with no sprite falls back to the scroll icon). */
const iconUrl = (key: ResourceKey): string => pixelIconSrc((RESOURCE_PIXEL_ICONS[key] ?? 'menu_bag_scroll') as PixelIconName);

/**
 * The resource chips of the top bar, one tray per tier of the resource catalog (currency | base materials | farm goods ...), the same grouping, discovery rule (a T2+ material shows once met), compact-header
 * preference and click actions as the header always had: gold and the merchant's goods open the Merchant on that row (IDL-315), gems open the Gem shop, Embers open the Rebirth window. Hovering a chip shows its own stock,
 * income, bonus and what it sells for.
 */
const ResourceTrays: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const gems = useGameStore((state) => state.gems);
	const embers = useGameStore((state) => state.prestige.legacyPoints); // saved under its old name, see PrestigeState
	const compact = useUiStore((state) => state.compactHeader);
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const toggleMerchantOn = useUiStore((state) => state.toggleMerchantOn);

	const amountOf = (key: ResourceKey): number =>
		key === 'gems' ? gems : key === 'embers' ? embers : ((resources as unknown as Record<string, number>)[key] ?? 0);

	return (
		<>
			{RESOURCE_TIERS.map((tier) => {
				const chips = resourcesInTier(tier.id).flatMap((key) => {
					const amount = amountOf(key);
					// production only exists for what the land and farm make; gems and embers come in lumps
					const produced = key in resources && key !== 'xp';
					const rate = produced ? resourceRates.total[key as keyof typeof resourceRates.total] : undefined;
					const bonus = produced ? resourceRates.modifiers[key as keyof typeof resourceRates.modifiers] : undefined;
					if (!resourceDiscovered(key, amount, rate)) return [];

					const isGems = key === 'gems';
					const isEmbers = key === 'embers';
					const price = (MERCHANT_RESOURCE_PRICES as Record<string, number | undefined>)[key];
					const opensMerchant = !isGems && !isEmbers && (key === 'gold' || price !== undefined);
					const act = isGems ? toggleGemShop : isEmbers ? toggleRebirth : opensMerchant ? () => toggleMerchantOn(key) : undefined;
					const production = rate === undefined ? null : formatRateAuto(rate);
					const rows = [
						{ label: 'Stock', value: exactOf(amount) },
						...(rate === undefined ? [] : [{ label: 'Income', value: production ?? 'none', tone: production ? ('gold' as const) : undefined }]),
						...(rate && rate > 0 ? [{ label: 'Per hour', value: formatHeaderAmount(rate * 3600) }] : []),
						...(bonus !== undefined && bonus > 0.0005 ? [{ label: 'Bonus', value: `+${formatPercent(bonus * 100)}`, tone: 'green' as const }] : []),
					];
					const footer: [string, string] = [
						price !== undefined ? `Sells for ${price}` : '',
						isGems ? 'Click to open the Gem shop' : isEmbers ? 'Click to open Rebirth' : opensMerchant ? 'Click to open Merchant' : '',
					];
					return [
						<ResourceStat
							key={key}
							icon={iconUrl(key)}
							name={RESOURCES[key].label}
							value={compact ? '' : formatHeaderAmount(amount)}
							rows={rows}
							footer={footer}
							chip={{ onClick: act, 'data-tutorial': `res-${key}` }}
						/>,
					];
				});
				return chips.length ? <ChipGroup key={tier.id}>{chips}</ChipGroup> : null;
			})}
		</>
	);
};

/**
 * The top bar of the game screen drawn with the design system: the resource trays in the middle and on the right the game menu (settings, save, export). The hero's portrait, the Gem shop and the windows are in the dock.
 */
const HudTopBar: React.FC = () => {
	const settingsOpen = useUiStore((state) => state.settingsOpen);

	return (
		<TopBar
			right={
				<>
					<GlyphButton
						glyph='⚙'
						label='Game menu: settings, save, export'
						active={settingsOpen}
						// data-ctx-anchor: a second click closes the dropdown instead of reopening it
						data-ctx-anchor=''
						onClick={(event) => {
							const ui = useUiStore.getState();
							if (ui.contextMenu) return ui.closeContextMenu();
							const box = event.currentTarget.getBoundingClientRect();
							openMenuAt(box.right - 4, box.bottom + 4, 'Menu', [], true);
						}}
					/>
				</>
			}
		>
			<span data-tutorial='top-resources' style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
				<ResourceTrays />
			</span>
		</TopBar>
	);
};

export default HudTopBar;
