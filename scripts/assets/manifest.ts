/**
 * The asset library: `buildManifest()` lists every picture the game uses or could reuse under one stable NAME, grouped by category (potions, weapons, armor,
 * accessories, monsters, buildings, resources, map-details, ui, portraits, unsorted). Biomes, roads, terrain atlases and ground textures are left out on purpose.
 * Registered art keeps its registry id (item icons, monster and resource rosters, `pixelIcons.ts`); raw pack files in `public/pixel/assets_to_assess_and_use/`
 * get a generated name (`<pack>_<file>`, e.g. `tree_autumn_tree1`), with shadow renderings folded into `variants`; `scripts/assets/names.json` renames any of them.
 * `npm run assets:catalog` renders it into `docs/assets/` (manifest.json plus one page per category), which `stories/assets/` shows in Storybook
 * (`npm run storybook`) and `tests/docs/assets.test.ts` keeps current. Never edit `docs/assets/` by hand.
 *
 * @title Asset library
 * @category Architecture/Art
 * @order 3
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { MERCHANT_PORTRAIT } from '../../src/config/npcPortraits';
import { ITEM_ICONS } from '../../src/config/itemIcons';
import { MONSTER_CATALOG, monsterArtUrl } from '../../src/catalog/monsters';
import { AVATARS } from '../../src/catalog/avatars';
import { ITEMS } from '../../src/catalog/items';
import { RESOURCE_ART, resourceArtUrl } from '../../src/catalog/resourceArt';
import {
	ANIMAL_PIXEL_ICONS,
	BUILDING_PIXEL_ICONS,
	EQUIPMENT_PIXEL_ICONS,
	RESERVED_RESOURCES,
	RESOURCE_PIXEL_ICONS,
	SHINE_SHEETS,
} from '../../src/config/pixelIcons';

export const ROOT = resolve(__dirname, '..', '..');
const PUBLIC = join(ROOT, 'public');

export type AssetCategory =
	| 'potions'
	| 'weapons'
	| 'armor'
	| 'accessories'
	| 'monsters'
	| 'buildings'
	| 'resources'
	| 'map-details'
	| 'ui'
	| 'portraits'
	| 'unsorted';
/**
 * used = live in the game now (enabled item, monster or resource; icon referenced by code); planned = its item/monster/resource exists but is disabled; retired = item no longer drops, old saves keep it; unused = registered art that nothing references (an icon no item uses, an icon no code mentions);
 * placeholder = a stand-in silhouette; spare = generated art nobody asked for (`_name.png`); reuse = raw pack art, not wired.
 */
export type AssetStatus = 'used' | 'planned' | 'retired' | 'unused' | 'placeholder' | 'spare' | 'reuse';

export interface AssetEntry {
	/** The stable name to refer to this asset by (an agent can be told "use `potion_pack_07`" or "delete `tree_autumn_tree1`") */
	name: string;
	category: AssetCategory;
	subcategory: string;
	/** Served URL of the default picture (`/pixel/...`, relative to public/) */
	src: string;
	size: [number, number];
	status: AssetStatus;
	/** What uses it: item id, monster id, building type, resource key ... */
	usedBy: string[];
	/** Gear only: equipment slot (`head`, `neck`, `ring`, `mainHand`, `offHand` ...), and weapon type / grade where known, for sorting and filtering */
	slot?: string;
	weaponType?: string;
	grade?: string;
	/** Folder or registry the picture came from */
	source: string;
	/** Other renderings of the same object (no shadow, soft shadow, shadow on grass ...), variant -> URL */
	variants?: Record<string, string>;
}

export const CATEGORIES: readonly { id: AssetCategory; title: string; blurb: string }[] = [
	{ id: 'potions', title: 'Potions', blurb: 'Consumables in the game and the 48 raw potion icons waiting in the reuse pool.' },
	{ id: 'weapons', title: 'Weapons', blurb: 'Main-hand and off-hand icons (swords, axes, bows, staves, shields, tomes ...), by grade.' },
	{ id: 'armor', title: 'Armor', blurb: 'Head, shoulder, chest, hands, legs, feet, cape and belt icons, by grade.' },
	{ id: 'accessories', title: 'Accessories', blurb: 'Neck, ring and charm icons.' },
	{ id: 'monsters', title: 'Monsters', blurb: 'The monster roster art, per biome, plus planned monsters that have no picture yet.' },
	{ id: 'buildings', title: 'Buildings', blurb: 'The 16 map buildings and the castle in the game, and the village packs waiting in the reuse pool.' },
	{ id: 'resources', title: 'Resources', blurb: 'Currencies, materials, farm goods, planned T2/T3 goods and spare resource art.' },
	{
		id: 'map-details',
		title: 'Map details',
		blurb: 'Trees, bushes, rocks, minerals, ruins, props and creatures to dress the map. None is wired yet; use a variant that matches the ground.',
	},
	{ id: 'ui', title: 'UI', blurb: 'Menu icons, equipment slot icons, banners, bars, frames, effects.' },
	{
		id: 'portraits',
		title: 'Portraits',
		blurb:
			'NPC faces (48px busts): merchant, quest giver, gambler, blacksmith, innkeepers and more. A few stand behind the merchant counter, the rest are ready for quests and dialogue.',
	},
	{ id: 'unsorted', title: 'Unsorted cuts', blurb: 'Loose cuts in public/pixel/reuse, not classified yet.' },
];

const readNames = (): Record<string, string> => {
	const file = join(ROOT, 'scripts', 'assets', 'names.json');
	return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
};

/** PNG width and height from the IHDR chunk */
const pngSize = (file: string): [number, number] => {
	const b = readFileSync(file);
	return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const url = (file: string) => '/' + relative(PUBLIC, file).split(sep).join('/');
const abs = (src: string) => join(PUBLIC, src);
const snake = (s: string) =>
	s
		.replace(/\.png$/i, '')
		.replace(/['’]/g, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toLowerCase();

const walk = (dir: string): string[] =>
	existsSync(dir)
		? readdirSync(dir)
				.sort()
				.flatMap((n) => {
					const full = join(dir, n);
					return statSync(full).isDirectory() ? walk(full) : n.toLowerCase().endsWith('.png') ? [full] : [];
				})
		: [];

/** Source text of src/ outside the icon-size table, to see whether an icon name is mentioned by any code */
const srcText = (() => {
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((n) => {
			const f = join(dir, n);
			return statSync(f).isDirectory() ? files(f) : /\.(ts|tsx|css)$/.test(n) ? [f] : [];
		});
	return files(join(ROOT, 'src'))
		.map((f) => {
			const t = readFileSync(f, 'utf8');
			return f.endsWith('pixelIcons.ts')
				? t
						.split('\n')
						.filter((l) => !/^\s*\w+:\s*\[\d+,\s*\d+\],?/.test(l))
						.join('\n')
				: t;
		})
		.join('\n');
})();
const mentioned = (name: string) => {
	if (new RegExp(`['"\`]${name}['"\`]`).test(srcText)) return true;
	// icon names built at run time, e.g. `menu_${key}` or `level_${n}`
	return [...name.matchAll(/_/g)].some((m) => srcText.includes(`${name.slice(0, m.index! + 1)}\${`));
};

export const buildManifest = (): AssetEntry[] => {
	const entries: AssetEntry[] = [];
	const add = (e: Omit<AssetEntry, 'size' | 'usedBy'> & { usedBy?: string[]; size?: [number, number] }) => {
		const size = e.size ?? pngSize(abs(e.src));
		entries.push({ usedBy: [], ...e, size });
	};
	const itemDefs = new Map(ITEMS.map((i) => [i.id, i]));

	// 1. Item icons (registry src/config/itemIcons). Supplied art lives in items/, built icons in icons/.
	const registeredItemFiles = new Set<string>();
	for (const e of ITEM_ICONS) {
		const src = e.file ? `/pixel/items/${e.file}.png` : `/pixel/icons/${e.icon}.png`;
		if (!existsSync(abs(src))) continue;
		if (e.file) registeredItemFiles.add(src);
		const category: AssetCategory =
			e.slot === 'consumable'
				? 'potions'
				: e.slot === 'mainHand' || e.slot === 'offHand'
					? 'weapons'
					: ['neck', 'ring', 'charm'].includes(e.slot)
						? 'accessories'
						: 'armor';
		const def = e.item ? itemDefs.get(e.item) : undefined;
		const status: AssetStatus = e.provenance.startsWith('placeholder')
			? 'placeholder'
			: !def
				? 'unused'
				: def.retired
					? 'retired'
					: def.enabled !== false
						? 'used'
						: 'planned';
		add({
			name: e.icon,
			category,
			subcategory: [e.slot, e.weapon].filter(Boolean).join('/') + (e.grade ? ` ${e.grade}` : ''),
			src,
			status,
			usedBy: e.item ? [e.item] : [],
			slot: e.slot,
			weaponType: e.weapon ?? undefined,
			grade: e.grade ?? undefined,
			source: 'itemIcons registry',
		});
	}
	// spare item art (`_name.png`, kept out of the registry on purpose)
	for (const f of walk(join(PUBLIC, 'pixel', 'items'))) {
		const src = url(f);
		if (registeredItemFiles.has(src)) continue;
		const slot = relative(join(PUBLIC, 'pixel', 'items'), f).split(sep)[0];
		const category: AssetCategory =
			slot === 'consumable'
				? 'potions'
				: slot === 'mainHand' || slot === 'offHand'
					? 'weapons'
					: ['neck', 'ring', 'charm'].includes(slot)
						? 'accessories'
						: 'armor';
		add({
			name: `spare_${snake(slot)}_${snake(basename(f)).replace(/^_/, '')}`,
			category,
			subcategory: slot,
			src,
			status: 'spare',
			source: 'public/pixel/items',
		});
	}

	// 2. Monsters
	for (const m of MONSTER_CATALOG) {
		const src = monsterArtUrl(m);
		if (!existsSync(abs(src))) continue;
		add({
			name: `monster_${snake(m.id)}`,
			category: 'monsters',
			subcategory: `${m.biomes[0]} ${m.grade}`,
			src,
			status: m.enabled ? 'used' : 'planned',
			usedBy: [m.id],
			source: 'monster roster',
		});
	}

	// 3. Resources
	const resourceFiles = new Set<string>();
	for (const r of RESOURCE_ART) {
		const src = resourceArtUrl(r);
		if (!existsSync(abs(src))) continue;
		resourceFiles.add(src);
		add({
			name: `resource_${snake(r.id)}`,
			category: 'resources',
			subcategory: r.tier + (r.biome ? ` ${r.biome}` : ''),
			src,
			status: r.enabled ? 'used' : 'planned',
			usedBy: [r.id],
			source: 'resource roster',
		});
	}
	for (const f of walk(join(PUBLIC, 'pixel', 'resources'))) {
		if (resourceFiles.has(url(f))) continue;
		add({
			name: `resource_spare_${snake(basename(f)).replace(/^_/, '')}`,
			category: 'resources',
			subcategory: 'spare',
			src: url(f),
			status: 'spare',
			source: 'public/pixel/resources',
		});
	}

	// 4. icons/ (built sprites). item_* are covered by the registry above; map terrain (biome_, meadow_, water_) is left out.
	const keysUsing = (map: Record<string, string | undefined>, prefix: string) => {
		const out = new Map<string, string[]>();
		for (const [k, v] of Object.entries(map)) if (v) out.set(v, [...(out.get(v) ?? []), `${prefix}${k}`]);
		return out;
	};
	const usage = new Map<string, string[]>();
	for (const [prefix, map] of [
		['building:', BUILDING_PIXEL_ICONS],
		['slot:', EQUIPMENT_PIXEL_ICONS],
		['resource:', RESOURCE_PIXEL_ICONS],
		['animal:', ANIMAL_PIXEL_ICONS],
		['shine:', Object.fromEntries(Object.entries(SHINE_SHEETS).map(([k, v]) => [k, v]))],
	] as const) {
		for (const [icon, users] of keysUsing(map as Record<string, string>, prefix)) usage.set(icon, [...(usage.get(icon) ?? []), ...users]);
	}
	const reserved = new Set(Object.values(RESERVED_RESOURCES));
	const itemIconNames = new Set(ITEM_ICONS.map((e) => e.icon));
	for (const f of walk(join(PUBLIC, 'pixel', 'icons'))) {
		const id = basename(f, '.png');
		if (itemIconNames.has(id) || /^(biome|meadow|water)_/.test(id)) continue;
		const category: AssetCategory =
			id.startsWith('building_') || id.startsWith('castle_')
				? 'buildings'
				: /^(res_|animal_|farm_)/.test(id) || /^(gold|wood|stone|coal|food|meat|eggs|milk|hide|legacy|diamond|comp_)/.test(id)
					? 'resources'
					: id.startsWith('monster_')
						? 'monsters'
						: 'ui';
		const users = usage.get(id) ?? [];
		const wired = users.length > 0 || id.startsWith('castle_') || mentioned(id);
		add({
			name: id,
			category,
			subcategory: id.replace(/_.*/, ''),
			src: url(f),
			status: reserved.has(id as never) ? 'planned' : wired ? 'used' : 'unused',
			usedBy: users,
			source: 'public/pixel/icons',
		});
	}

	// 5. UI parts and effects
	for (const f of walk(join(PUBLIC, 'pixel', 'ui')))
		add({ name: `ui_${snake(basename(f))}`, category: 'ui', subcategory: 'frames and bars', src: url(f), status: 'used', source: 'public/pixel/ui' });
	for (const f of walk(join(PUBLIC, 'fx')))
		add({
			name: `fx_${snake(relative(join(PUBLIC, 'fx'), f).split(sep).join('_'))}`,
			category: 'ui',
			subcategory: 'effects',
			src: url(f),
			status: 'used',
			source: 'public/fx',
		});

	// 5b. NPC portraits (public/pixel/portraits, picked per merchant tab by src/config/npcPortraits.ts)
	const portraitUsers = new Map<string, string[]>();
	for (const [tab, name] of Object.entries(MERCHANT_PORTRAIT)) portraitUsers.set(name, [...(portraitUsers.get(name) ?? []), `merchant:${tab}`]);
	for (const f of walk(join(PUBLIC, 'pixel', 'portraits'))) {
		const id = basename(f, '.png');
		const users = portraitUsers.get(id) ?? [];
		add({
			name: `portrait_${id.replace(/^npc_/, '')}`,
			category: 'portraits',
			subcategory: 'NPC busts 48px',
			src: url(f),
			status: users.length ? 'used' : 'reuse',
			usedBy: users,
			source: 'public/pixel/portraits',
		});
	}

	// 6. Reuse pools
	const POOL = join(PUBLIC, 'pixel', 'assets_to_assess_and_use');
	// `plain` = what a file with no variant marker is: most packs keep the no-shadow art in `Assets/`, but rocks and fantasy trees ship the shadowed art plain and mark the other `no_shadow`
	const variantOf = (rel: string, file: string, plain: string): string => {
		const low = rel.toLowerCase();
		if (/texture_shadows?_dark/.test(low)) return 'texture-dark';
		if (/texture_shadow/.test(low)) return 'texture';
		if (/no_shadow/.test(low) || /no_shadow/.test(file.toLowerCase())) return 'none';
		if (/_shadow(\/|$)|\/shadow/.test(low)) return 'shadow';
		return plain;
	};
	const PACKS: Record<string, { prefix: string; category: AssetCategory; sub: string; plain?: string }> = {
		trees_mapp_details: { prefix: 'tree', category: 'map-details', sub: 'trees' },
		bushes_map_details_mostly: { prefix: 'bush', category: 'map-details', sub: 'bushes' },
		map_details_3: { prefix: 'rock', category: 'map-details', sub: 'rocks', plain: 'shadow' },
		minerals_map_details_or_resources_crafting_etc: { prefix: 'mineral', category: 'map-details', sub: 'minerals' },
		map_details_ruins_buildings: { prefix: 'ruin', category: 'map-details', sub: 'ruins' },
		misc: { prefix: 'prop', category: 'map-details', sub: 'dark and bone props' },
		misc_map_details: { prefix: 'fantasy', category: 'map-details', sub: 'fantasy trees and mushrooms', plain: 'shadow' },
		map_details_misc: { prefix: 'mapmisc', category: 'map-details', sub: 'creatures and temple sheets' },
		map_details: { prefix: 'farmplants', category: 'map-details', sub: 'farm plants sheet' },
	};
	for (const [pack, def] of Object.entries(PACKS)) {
		const groups = new Map<string, { variants: Record<string, string>; sheet: boolean }>();
		for (const f of walk(join(POOL, pack))) {
			const rel = relative(join(POOL, pack), f).split(sep).join('/');
			const file = basename(f);
			const sheet = /source/i.test(file) || !rel.includes('/');
			const sizeDir = /\/(\d+)\//.exec(rel)?.[1];
			const base =
				snake(file.replace(/_?(no_shadow|texture_shadows?(_dark)?)(?=\.png$|_source)/i, '').replace(/_?no_shadow/i, '')) + (sizeDir ? `_s${sizeDir}` : '');
			const key = (sheet ? `sheet_${base}` : base).replace(/^_/, '');
			const g = groups.get(key) ?? { variants: {}, sheet };
			const v = variantOf(rel, file, def.plain ?? 'none');
			if (!g.variants[v] || v === 'none') g.variants[v] = url(f);
			groups.set(key, g);
		}
		for (const [key, g] of groups) {
			const order = ['none', 'shadow', 'texture', 'texture-dark'];
			const have = order.filter((v) => g.variants[v]);
			const src = g.variants[have[0]];
			add({
				name: key.startsWith(`${def.prefix}_`) ? key : `${def.prefix}_${key}`,
				category: def.category,
				subcategory: def.sub + (g.sheet ? ' (sheet)' : ''),
				src,
				status: 'reuse',
				source: `assets_to_assess_and_use/${pack}`,
				variants: have.length > 1 ? Object.fromEntries(have.map((v) => [v, g.variants[v]])) : undefined,
			});
		}
	}
	for (const f of walk(join(POOL, 'potions')))
		add({
			name: `potion_pack_${snake(basename(f)).replace(/^icon/, '').padStart(2, '0')}`,
			category: 'potions',
			subcategory: 'raw pack 32px',
			src: url(f),
			status: 'reuse',
			source: 'assets_to_assess_and_use/potions',
		});
	for (const f of walk(join(POOL, 'buildings')))
		add({
			name: `building_medieval_${(/\((\d+)\)/.exec(basename(f))?.[1] ?? snake(basename(f))).padStart(3, '0')}`,
			category: 'buildings',
			subcategory: 'medieval pack 52px',
			src: url(f),
			status: 'reuse',
			source: 'assets_to_assess_and_use/buildings',
		});
	for (const f of walk(join(POOL, 'more_buildings'))) {
		if (/^(titel|text)\./i.test(basename(f))) continue;
		add({
			name: `building_village_${snake(basename(f))}`,
			category: 'buildings',
			subcategory: 'village pack 80px (named)',
			src: url(f),
			status: 'reuse',
			source: 'assets_to_assess_and_use/more_buildings',
		});
	}
	for (const f of walk(join(POOL, 'monsters')))
		add({
			name: `monster_pack_${snake(basename(f))}`,
			category: 'monsters',
			subcategory: 'new biome monsters (not wired)',
			src: url(f),
			status: 'reuse',
			source: 'assets_to_assess_and_use/monsters',
		});
	for (const f of walk(join(PUBLIC, 'pixel', 'new_assets', 'heroes')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'portraits',
				subcategory: AVATARS.some((a) => a.portrait === basename(f, '.png')) ? 'avatar portraits' : 'avatar portraits (spare, for later unlocks)',
				src: url(f),
				status: AVATARS.some((a) => a.portrait === basename(f, '.png')) ? 'used' : 'reuse',
				usedBy: AVATARS.filter((a) => a.portrait === basename(f, '.png')).map((a) => a.id),
				source: 'new_assets/heroes',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'new_assets', 'achievements')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'ui',
				subcategory: 'achievement badges (not wired)',
				src: url(f),
				status: 'reuse',
				source: 'new_assets/achievements',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'reuse'))) {
		const kind = relative(join(PUBLIC, 'pixel', 'reuse'), f).split(sep)[0];
		add({
			name: `reuse_${snake(kind)}_${snake(basename(f))
				.replace(/^sprite_fusion_/, 'sf_')
				.slice(0, 15)}`,
			category: 'unsorted',
			subcategory: kind,
			src: url(f),
			status: 'reuse',
			source: 'public/pixel/reuse',
		});
	}

	// Names: apply overrides (keyed by default src), then make every name unique and sort.
	const overrides = readNames();
	for (const e of entries) if (overrides[e.src]) e.name = overrides[e.src];
	const seen = new Map<string, number>();
	for (const e of entries) {
		const n = (seen.get(e.name) ?? 0) + 1;
		seen.set(e.name, n);
		if (n > 1) e.name = `${e.name}_${n}`;
	}
	const rank = new Map(CATEGORIES.map((c, i) => [c.id, i]));
	return entries.sort((a, b) => rank.get(a.category)! - rank.get(b.category)! || a.subcategory.localeCompare(b.subcategory) || a.name.localeCompare(b.name));
};
