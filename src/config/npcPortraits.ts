/**
 * The NPC portraits: 12 small bust pictures (48x48, transparent, Sprite Fusion) in `public/pixel/portraits/`, named `npc_<who>`. They are NOT the 40x40 bust frame of
 * the avatars in `art_style_reference/ui-and-portraits/README.md`: keep them at their own size, drawn with `image-rendering: pixelated` (class `pixelated`).
 * None is shown in the game right now (the Merchant window dropped its per-tab face); they stay in the asset library (category Portraits) as ready faces for
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
