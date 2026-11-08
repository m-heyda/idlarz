// The item icon registry. One JSON file per slot (and per weapon type under mainHand) in this folder, one line per icon, so art PRs
// that add icons for different families never touch the same file. Read by this module (config/pixelIcons.ts) and by the build
// script (scripts/pixel/item_registry.py), so an icon is wired in exactly one place. The rules for adding one are in README.md.
import belt from './belt.json';
import cape from './cape.json';
import charm from './charm.json';
import chest from './chest.json';
import consumable from './consumable.json';
import feet from './feet.json';
import hands from './hands.json';
import head from './head.json';
import legs from './legs.json';
import mainHandAxe from './mainHand-axe.json';
import mainHandBow from './mainHand-bow.json';
import mainHandCrossbow from './mainHand-crossbow.json';
import mainHandDagger from './mainHand-dagger.json';
import mainHandMace from './mainHand-mace.json';
import mainHandMaul from './mainHand-maul.json';
import mainHandSpear from './mainHand-spear.json';
import mainHandStaff from './mainHand-staff.json';
import mainHandSword from './mainHand-sword.json';
import mainHandWand from './mainHand-wand.json';
import neck from './neck.json';
import offHandShield from './offHand-shield.json';
import offHandTome from './offHand-tome.json';
import placeholders from './placeholders.json';
import ring from './ring.json';
import shoulder from './shoulder.json';

export interface ItemIconEntry {
	/** The icon name the catalog uses (`ItemDef.icon`): `art_<id>` for supplied 64 px art, `item_<id>` for a built 40 px icon */
	icon: string;
	/** The catalog item that uses it, or null while the art has no item yet */
	item: string | null;
	/** Supplied art: path under public/pixel/items without `.png`. null = the build script draws it (public/pixel/icons/<icon>.png) */
	file: string | null;
	slot: string;
	/** Weapon type of a main-hand or off-hand icon */
	weapon: string | null;
	/** G1-G9 or S1-S3 (docs/plan/26-next-updates-plan.md, art_style_reference/equip/README.md section 3); null until the item is graded */
	grade: string | null;
	/** Where the picture came from: sheet and region, Sprite Fusion prompt, or the generator (art README rules 5 and 8) */
	provenance: string;
}

/** Add a line to the JSON file of its slot; add a file here only for a new slot or weapon type. */
export const ITEM_ICON_FILES: Record<string, ItemIconEntry[]> = {
	belt,
	cape,
	charm,
	chest,
	consumable,
	feet,
	hands,
	head,
	legs,
	'mainHand-axe': mainHandAxe,
	'mainHand-bow': mainHandBow,
	'mainHand-crossbow': mainHandCrossbow,
	'mainHand-dagger': mainHandDagger,
	'mainHand-mace': mainHandMace,
	'mainHand-maul': mainHandMaul,
	'mainHand-spear': mainHandSpear,
	'mainHand-staff': mainHandStaff,
	'mainHand-sword': mainHandSword,
	'mainHand-wand': mainHandWand,
	neck,
	placeholders,
	'offHand-shield': offHandShield,
	'offHand-tome': offHandTome,
	ring,
	shoulder,
};

export const ITEM_ICONS: readonly ItemIconEntry[] = Object.values(ITEM_ICON_FILES).flat();

/** Native size of supplied item art. It is shown 1:1 (or an integer multiple): 64 does not scale to the 40 px icon grid without blurring. */
export const ITEM_ART_SIZE = [64, 64] as const;
/** Native size of a built item icon */
export const ITEM_ICON_SIZE = [40, 40] as const;
