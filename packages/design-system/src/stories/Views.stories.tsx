import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BestiaryView, DeedsView } from '../views/glossary';
import { BuildingUpgradesView, GameHudView, HeroWindowView, MerchantView, TooltipsView } from '../views/views';

const meta = {
	title: 'Design System/Views',
	parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Resources-only top bar, stone icon dock, map, minimap. Character sheet is a window. */
export const GameHud: Story = { render: () => <GameHudView /> };
/** Compact character screen with Bag / Stats / Crafting tabs. */
export const HeroWindow: Story = { render: () => <HeroWindowView /> };
/** Merchant, reworked Upgrades tab with diamond level gems. */
export const MerchantUpgrades: Story = { render: () => <MerchantView initialTab='upgrades' /> };
/** Merchant, Goods tab: the shelf, your bag, quick sell. */
export const MerchantGoods: Story = { render: () => <MerchantView initialTab='goods' /> };
/** Merchant, Resources tab: parchment stock ledger and trade ticket. */
export const MerchantResources: Story = { render: () => <MerchantView initialTab='resources' /> };
/** Building upgrades reuse the same tile. */
export const BuildingUpgrades: Story = { render: () => <BuildingUpgradesView /> };
/** All tooltip variants, rim and glow follow rarity. */
export const Tooltips: Story = { render: () => <TooltipsView /> };
/** Hall of Deeds (replaces Achievements): categories, tiered deeds with Claim, paper detail. */
export const HallOfDeeds: Story = { render: () => <DeedsView /> };
/** Bestiary: monster grid with mastery gems, paper detail with claimable mastery tiers. */
export const Bestiary: Story = { render: () => <BestiaryView /> };
