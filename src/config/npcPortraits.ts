import type { MerchantTab } from '@/types/game';

/**
 * The NPC portraits: 12 small bust pictures (48x48, transparent, Sprite Fusion) in `public/pixel/portraits/`, named `npc_<who>`. They are NOT the 40x40 bust frame of
 * the avatars in `art_style_reference/ui-and-portraits/README.md`: keep them at their own size, drawn with `image-rendering: pixelated` (class `pixelated`).
 * The merchant window shows one face per tab (`MERCHANT_PORTRAIT`); every other portrait stays in the asset library (category Portraits) as a ready face for
 * a future quest giver, innkeeper, blacksmith or dialogue.
 *
 * @category Architecture/Art
 * @order 4
 */
export const NPC_PORTRAITS = [
	'npc_brawler',
	'npc_farmer_woman',
	'npc_herbalist',
	'npc_blacksmith',
	'npc_innkeeper_woman',
	'npc_hermit_sage',
	'npc_merchant',
	'npc_jester',
	'npc_grandma',
	'npc_tavern_keeper',
	'npc_quest_giver',
	'npc_scout',
] as const;
export type NpcPortrait = (typeof NPC_PORTRAITS)[number];

/** Served URL of an NPC portrait */
export const npcPortraitUrl = (name: NpcPortrait): string => `/pixel/portraits/${name}.png`;

/** Who stands behind the counter on each merchant tab: the trader for the shop tabs, the tavern regular for quests, the jester for gambling (fixed, never random) */
export const MERCHANT_PORTRAIT: Record<MerchantTab, NpcPortrait> = {
	resources: 'npc_merchant',
	goods: 'npc_merchant',
	upgrades: 'npc_blacksmith',
	quests: 'npc_quest_giver',
	gambling: 'npc_jester',
};
