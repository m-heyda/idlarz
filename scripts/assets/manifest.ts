/**
 * The asset library: `buildManifest()` lists every picture the game uses or could reuse under one stable NAME, grouped by category (potions, weapons, armor,
 * accessories, monsters, buildings, resources, map-details, ui, portraits, biomes, map-ground, unsorted). Every picture under `public/` is listed (only the title cards of the village pack are skipped).
 * Every entry carries one of three tags: `used` (the game loads it), `planned` (picked for a feature that is not built) or `unused` (everything else: pool art, spares, alternatives).
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
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { ITEM_ICONS } from '../../src/config/itemIcons';
import { MONSTERS } from '../../src/config/combatConfig';
import { MONSTER_CATALOG, monsterArtUrl } from '../../src/catalog/monsters';
import { AVATARS } from '../../src/catalog/avatars';
import { BUILDINGS } from '../../src/catalog/buildings';
import { GUIDE_SPRITE, GUIDE_TALK_SHEET } from '../../src/catalog/tutorial';
import { BIOME_ART } from '../../src/config/biomeArt';
import { ITEMS } from '../../src/catalog/items';
import { RESOURCE_ART, resourceArtUrl } from '../../src/catalog/resourceArt';
import { ANIMAL_PIXEL_ICONS, EQUIPMENT_PIXEL_ICONS, RESERVED_RESOURCES, RESOURCE_PIXEL_ICONS, SHINE_SHEETS } from '../../src/config/pixelIcons';

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
	| 'biomes'
	| 'map-ground'
	| 'sets'
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
	{
		id: 'buildings',
		title: 'Buildings',
		blurb: 'The map buildings, the 10 castle levels and the 14 castle skins (not wired yet), the Idol statues, and the village packs waiting in the pool.',
	},
	{ id: 'resources', title: 'Resources', blurb: 'Currencies, materials, farm goods, planned T2/T3 goods and spare resource art.' },
	{
		id: 'map-details',
		title: 'Map details',
		blurb: 'Bushes, rocks, ruins, fantasy trees, props and creatures to dress the map. None is wired yet; use a variant that matches the ground.',
	},
	{ id: 'ui', title: 'UI', blurb: 'Menu icons, equipment slot icons, banners, bars, frames, effects.' },
	{
		id: 'portraits',
		title: 'Portraits',
		blurb: 'The avatar busts for the picker (ui/heroes), the guide and the wireframe early-tester set.',
	},
	{
		id: 'biomes',
		title: 'Biomes',
		blurb: 'Framed 80px landscape vignettes, one per rebirth biome, shown in the "New land unlocked" window.',
	},
	{
		id: 'sets',
		title: 'Equipment sets',
		blurb:
			'63 matching sets sliced from three 64 px sheets (knight, samurai, shinobi), one folder per set in __reuse/sets. A set has armor pieces, weapons and accessories (belt, neck, mask), and may use fewer pieces than the sheet row: the grouping is in scripts/assets/equipment-sets.json. Effects come later.',
	},
	{
		id: 'map-ground',
		title: 'Map ground and backdrops',
		blurb:
			'Ground textures, shape atlases and shores that TerrainLayer draws, the cracked-stone, fog and meadow backdrops, and the biome, meadow and water icons.',
	},
	{ id: 'unsorted', title: 'Unsorted cuts', blurb: 'Loose cuts in public/pixel/__reuse, not classified yet.' },
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

/** Source files of src/ (path relative to src, text) outside the icon-size table, to see which code mentions an icon name */
const srcFiles = (() => {
	const files = (dir: string): string[] =>
		readdirSync(dir)
			.sort() // the same order on every platform (Linux lists a directory unsorted), so the "used by" lists do not differ between machines and CI
			.flatMap((n) => {
				const f = join(dir, n);
				return statSync(f).isDirectory() ? files(f) : /\.(ts|tsx|css)$/.test(n) ? [f] : [];
			});
	return files(join(ROOT, 'src')).map((f) => {
		const t = readFileSync(f, 'utf8');
		return {
			file: relative(join(ROOT, 'src'), f).split(sep).join('/'),
			text: f.endsWith('pixelIcons.ts')
				? t
						.split('\n')
						.filter((l) => !/^\s*\w+:\s*\[\d+,\s*\d+\],?/.test(l))
						.join('\n')
				: t,
		};
	});
})();
/** Source files that mention an icon: its quoted name, its file in a CSS/URL path, or a run-time built name such as `menu_${key}` */
const mentionedIn = (name: string): string[] => {
	const quoted = new RegExp(`['"\`]${name}['"\`]|/${name}\\.png`);
	const prefixes = [...name.matchAll(/_/g)].map((m) => `${name.slice(0, m.index! + 1)}\${`);
	return srcFiles.filter((f) => quoted.test(f.text) || prefixes.some((p) => f.text.includes(p))).map((f) => f.file);
};

/** Pool pictures picked as art for the Idols (the third building of each biome, docs/plan/18, IDL-96): moved into Buildings as `planned`, under a stable name */
const IDOL_ART: Record<string, string> = {
	'/pixel/assets_to_assess_and_use/map_details_ruins_buildings/Assets/Blue-gray_ruins3.png': 'idol_blue_gray_ruins',
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
	// the stand-in pictures of monsters whose art is not made yet (one file serves a whole family)
	const standIns = new Map<string, string[]>();
	for (const m of MONSTER_CATALOG) if (m.placeholder && !m.art) standIns.set(m.placeholder, [...(standIns.get(m.placeholder) ?? []), m.id]);
	for (const [src, ids] of standIns) {
		if (!existsSync(abs(src))) continue;
		add({
			name: `monster_placeholder_${snake(basename(src))}`,
			category: 'monsters',
			subcategory: 'placeholder (stand-in until the real sprite)',
			src,
			status: ids.some((id) => id in MONSTERS) ? 'used' : 'planned',
			usedBy: ids,
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
	const keysUsing = (map: Record<string, string | readonly string[] | undefined>, prefix: string) => {
		const out = new Map<string, string[]>();
		for (const [k, v] of Object.entries(map)) for (const icon of [v ?? []].flat()) out.set(icon, [...(out.get(icon) ?? []), `${prefix}${k}`]);
		return out;
	};
	const usage = new Map<string, string[]>();
	for (const [prefix, map] of [
		['slot:', EQUIPMENT_PIXEL_ICONS],
		['resource:', RESOURCE_PIXEL_ICONS],
		['animal:', ANIMAL_PIXEL_ICONS],
		['shine:', Object.fromEntries(Object.entries(SHINE_SHEETS).map(([k, v]) => [k, v]))],
	] as const) {
		for (const [icon, users] of keysUsing(map as Record<string, string | readonly string[]>, prefix)) usage.set(icon, [...(usage.get(icon) ?? []), ...users]);
	}
	const reserved = new Set(Object.values(RESERVED_RESOURCES));
	const itemIconNames = new Set(ITEM_ICONS.map((e) => e.icon));
	for (const f of walk(join(PUBLIC, 'pixel', 'icons'))) {
		const id = basename(f, '.png');
		if (itemIconNames.has(id) || /^(biome|meadow|water)_/.test(id)) continue;
		const category: AssetCategory = id.startsWith('building_')
			? 'buildings'
			: /^(res_|animal_|farm_)/.test(id) || /^(gold|wood|stone|coal|food|meat|eggs|milk|hide|wool|legacy|diamond|comp_)/.test(id)
				? 'resources'
				: id.startsWith('monster_')
					? 'monsters'
					: 'ui';
		const users = usage.get(id) ?? [];
		const code = mentionedIn(id);
		const wired = users.length > 0 || code.length > 0;
		add({
			name: id,
			category,
			subcategory: id.replace(/_.*/, ''),
			src: url(f),
			status: reserved.has(id as never) ? 'planned' : wired ? 'used' : 'unused',
			usedBy: users.length
				? users
				: code
						.filter((f) => f !== 'config/pixelIcons.ts')
						.slice(0, 3)
						.map((f) => `src/${f}`),
			source: 'public/pixel/icons',
		});
	}

	// 4b. The castle: one sprite per upgrade level (in the game) and the premium skins (planned for the gem shop)
	for (const f of walk(join(PUBLIC, 'pixel', 'castles'))) {
		const id = basename(f, '.png');
		const skin = id.startsWith('castle_skin_');
		const loading = id === 'castle_loading';
		add({
			name: id,
			category: 'buildings',
			subcategory: skin ? 'castle skin' : 'castle',
			src: url(f),
			status: skin ? 'planned' : 'used',
			usedBy: skin ? [] : loading ? ['loading screen'] : ['castle level ' + id.replace('castle_', '')],
			source: 'public/pixel/castles',
		});
	}

	// 4c. The farm's loose parts (fence, buildings, water, trees ... from scripts/pixel/farm_parts.py) and the repeating meadow tile they stand on
	for (const f of walk(join(PUBLIC, 'pixel', 'farm')).filter((file) => file.endsWith('.png'))) {
		const id = basename(f, '.png');
		add({
			name: `farm_${id}`,
			category: 'map-details',
			subcategory: 'farm part',
			src: url(f),
			status: 'used',
			usedBy: ['farm window'],
			source: 'public/pixel/farm',
		});
	}
	add({
		name: 'farm_meadow',
		category: 'map-details',
		subcategory: 'farm part',
		src: url(join(PUBLIC, 'pixel', 'bg', 'farm_meadow.png')),
		status: 'used',
		usedBy: ['farm window background (repeats)'],
		source: 'public/pixel/bg',
	});

	// 5. UI parts and effects
	// `ui/` holds the frames, bars and menu icons; its `heroes/` (avatar busts), `blacksmith.png` and `alder_talk.png` are listed with their own entries further down
	const UI_ELSEWHERE = new Set(['heroes', 'admin', 'biomes', 'blacksmith.png', 'alder_talk.png', 'logo_idler_realm.png']);
	for (const f of walk(join(PUBLIC, 'pixel', 'ui'))) {
		const rel = relative(join(PUBLIC, 'pixel', 'ui'), f);
		if (UI_ELSEWHERE.has(rel.split(sep)[0])) continue;
		const menu = basename(f).startsWith('menu_');
		add({
			name: menu ? basename(f, '.png') : `ui_${snake(basename(f))}`,
			category: 'ui',
			subcategory: menu ? 'menu' : 'frames and bars',
			src: url(f),
			status: 'used',
			source: 'public/pixel/ui',
		});
	}
	for (const f of walk(join(PUBLIC, 'fx')))
		add({
			name: `fx_${snake(relative(join(PUBLIC, 'fx'), f).split(sep).join('_'))}`,
			category: 'ui',
			subcategory: 'effects',
			src: url(f),
			status: 'used',
			source: 'public/fx',
		});

	// 5b. NPC portraits (public/pixel/portraits, listed in src/config/npcPortraits.ts): ready faces, none wired into the game yet
	for (const f of walk(join(PUBLIC, 'pixel', 'portraits'))) {
		const id = basename(f, '.png');
		add({
			name: `portrait_${id.replace(/^npc_/, '')}`,
			category: 'portraits',
			subcategory: 'NPC busts 48px',
			src: url(f),
			status: 'reuse',
			usedBy: [],
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
		bushes_map_details_mostly: { prefix: 'bush', category: 'map-details', sub: 'bushes' },
		map_details_3: { prefix: 'rock', category: 'map-details', sub: 'rocks', plain: 'shadow' },
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
	// the village pictures the building catalog (src/catalog/buildings.ts) uses are in the game; the rest wait in the pool
	const buildingOfArt = new Map(BUILDINGS.map((b) => [decodeURIComponent(b.art), b.id]));
	for (const f of walk(join(POOL, 'more_buildings'))) {
		if (/^(titel|text)\./i.test(basename(f))) continue;
		const building = buildingOfArt.get(url(f));
		add({
			name: `building_village_${snake(basename(f))}`,
			category: 'buildings',
			subcategory: 'village pack 80px (named)',
			src: url(f),
			status: building ? 'used' : 'reuse',
			usedBy: building ? [`building:${building}`] : [],
			source: 'assets_to_assess_and_use/more_buildings',
		});
	}
	for (const f of walk(join(PUBLIC, 'pixel', 'ui', 'heroes')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'portraits',
				subcategory: AVATARS.some((a) => a.portrait === basename(f, '.png')) ? 'avatar portraits' : 'avatar portraits (spare, for later unlocks)',
				src: url(f),
				status: AVATARS.some((a) => a.portrait === basename(f, '.png')) ? 'used' : 'reuse',
				usedBy: AVATARS.filter((a) => a.portrait === basename(f, '.png')).map((a) => a.id),
				source: 'ui/heroes',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'achievements')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'ui',
				subcategory: 'achievement badges (not wired)',
				src: url(f),
				status: 'reuse',
				source: 'achievements',
			});
	// the admin mark: an 8 frame sprite sheet (32 px frames) drawn by the name of the game admin (`AdminMark` in the design system)
	for (const f of walk(join(PUBLIC, 'pixel', 'ui', 'admin')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'ui',
				subcategory: 'admin mark (8 frame sprite sheet)',
				src: url(f),
				status: 'used',
				usedBy: ['AdminMark'],
				source: 'ui/admin',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'wireframe')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'ui',
				subcategory: 'wireframe early-tester set (sources of the early tester portrait and badge; pets not wired)',
				src: url(f),
				status: 'planned',
				source: 'wireframe',
			});
	// The tutorial guide, Brother Alder: his one sprite (a cut from the reuse pool) and the two-frame talking sheet drawn from it by scripts/guide-sprite.ts
	add({
		name: 'guide_brother_alder_talk',
		category: 'portraits',
		subcategory: 'tutorial guide',
		src: GUIDE_TALK_SHEET,
		status: 'used',
		usedBy: ['tutorial:guide'],
		source: 'scripts/guide-sprite.ts',
	});
	// The blacksmith beside the Crafting tab of the Hero window (supplied art, background cut out and mirrored to face right)
	for (const f of walk(join(PUBLIC, 'pixel', 'ui')).filter((x) => basename(x) === 'blacksmith.png'))
		add({
			name: `crafting_${snake(basename(f))}`,
			category: 'ui',
			subcategory: 'crafting',
			src: url(f),
			status: 'used',
			usedBy: ['hero:crafting-tab'],
			source: 'ui',
		});
	// The mineable rocks on the map (supplied 64 px art): one picture per rock look, used by `config/rocks.ts`
	for (const f of walk(join(PUBLIC, 'pixel', 'rocks')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'map-details',
				subcategory: 'mineable rocks',
				src: url(f),
				status: 'used',
				usedBy: ['rocks'],
				source: 'rocks',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'idols')))
		if (f.endsWith('.png'))
			add({
				name: snake(basename(f)),
				category: 'buildings',
				subcategory: basename(f).startsWith('idol_alt_') ? 'idol statues (alternatives)' : 'idol statues (primary, planned)',
				src: url(f),
				status: basename(f).startsWith('idol_alt_') ? 'reuse' : 'planned',
				source: 'idols',
			});
	for (const f of walk(join(PUBLIC, 'pixel', 'ui', 'biomes')))
		if (f.endsWith('.png')) {
			const name = basename(f, '.png');
			const biome = name.replace(/^biome_/, '').replace(/_\d+$/, '');
			const inGame = Object.values(BIOME_ART).includes(name);
			add({
				name: snake(basename(f)),
				category: 'biomes',
				subcategory: biome.startsWith('extra_') ? 'extras (no such biome in the game)' : inGame ? `${biome} (in the game)` : `${biome} (alternatives)`,
				src: url(f),
				status: inGame ? 'used' : 'reuse',
				usedBy: inGame ? ['RebirthUnlockModal'] : [],
				source: 'ui/biomes',
			});
		}
	const reuseStatus = JSON.parse(readFileSync(join(ROOT, 'scripts', 'assets', 'reuse-status.json'), 'utf8')) as Record<
		string,
		{ status: AssetStatus; usedBy: string[] }
	>;
	for (const f of walk(join(PUBLIC, 'pixel', '__reuse'))) {
		const kind = relative(join(PUBLIC, 'pixel', '__reuse'), f).split(sep)[0];
		if (kind === 'equipment' || kind === 'sets') continue; // listed below with the armor and weapons
		if (url(f) === GUIDE_SPRITE) {
			add({
				name: 'guide_brother_alder',
				category: 'portraits',
				subcategory: 'tutorial guide',
				src: url(f),
				status: 'used',
				usedBy: ['tutorial:guide'],
				source: 'public/pixel/__reuse',
			});
			continue;
		}
		// a pool picture that a game icon was made from says so (`reuse-status.json`: src -> used / planned and what uses it), so the review in Storybook sorts what is wired from what is not
		const mark = reuseStatus[url(f)];
		add({
			name: `reuse_${snake(kind)}_${snake(basename(f))
				.replace(/^sprite_fusion_/, 'sf_')
				.slice(0, 15)}`,
			category: 'unsorted',
			subcategory: kind,
			src: url(f),
			status: mark?.status ?? 'reuse',
			usedBy: mark?.usedBy ?? [],
			source: 'public/pixel/__reuse',
		});
	}

	// 6b. Map ground and backdrops: used when the terrain renderer loads it (`terrainAtlas.json` styles and the lake shores), a CSS url or code names it; else unused
	const atlas = JSON.parse(readFileSync(join(ROOT, 'src', 'config', 'terrainAtlas.json'), 'utf8')) as { styles: string[] };
	const terrainLoaded = new Set(['props', 'shore_frost', 'shore_bog', ...atlas.styles.flatMap((s) => [`tex_${s}`, `shapes_${s}`])]);
	const groundDirs = [
		join(PUBLIC, 'pixel', 'bg'),
		join(PUBLIC, 'pixel', 'terrain'),
		join(PUBLIC, 'landing'),
		...['biome', 'meadow', 'water'].map(() => join(PUBLIC, 'pixel', 'icons')),
	];
	for (const dir of [...new Set(groundDirs)])
		for (const f of walk(dir)) {
			const id = basename(f, '.png');
			const sub = relative(PUBLIC, dirname(f)).split(sep).join('/');
			if (sub === 'pixel/icons' && !/^(biome|meadow|water)_/.test(id)) continue;
			const users = sub === 'pixel/terrain' ? (terrainLoaded.has(id) ? ['TerrainLayer'] : []) : mentionedIn(id);
			add({
				name: `ground_${snake(sub.replace(/^pixel\//, ''))}_${snake(id)}`,
				category: 'map-ground',
				subcategory: sub,
				src: url(f),
				status: users.length ? 'used' : 'unused',
				usedBy: users,
				source: sub,
			});
		}

	const CUT_SLOT: Record<string, string> = { cape: 'cape', shoulder: 'shoulder', bow: 'mainHand', axe: 'mainHand', tome: 'offHand' };
	// 6d. Equipment cut-outs (sheets supplied by the owner on 2026-11-16, one transparent PNG per item, full size): capes and shoulders go to Armor, bows, axes and tomes to Weapons.
	// `used` when a 64 px copy of it is registered as an item icon (`equipment-used.json`: cut-out -> icon), else `unused` pool art for new items and placeholders.
	const cutUse = JSON.parse(readFileSync(join(ROOT, 'scripts', 'assets', 'equipment-used.json'), 'utf8')) as Record<string, string>;
	for (const f of walk(join(PUBLIC, 'pixel', '__reuse', 'equipment'))) {
		const family = basename(dirname(f));
		const [style, ...rest] = basename(f, '.png').split('_');
		const icon = cutUse[url(f)];
		add({
			name: `cut_${family}_${style}_${rest.join('_')}`,
			category: family === 'cape' || family === 'shoulder' ? 'armor' : 'weapons',
			subcategory: `cut-outs: ${family} (${style})`,
			slot: CUT_SLOT[family],
			weaponType: family === 'bow' || family === 'axe' ? family : family === 'tome' ? 'tome' : undefined,
			src: url(f),
			status: icon ? 'used' : 'unused',
			usedBy: icon ? [icon] : [],
			source: '__reuse/equipment',
		});
	}

	// The game logo (cut out of the owner's picture on 2026-11-16, background removed): for the landing rework, not drawn yet
	add({
		name: 'logo_idler_realm',
		category: 'ui',
		subcategory: 'logo',
		src: '/pixel/ui/logo_idler_realm.png',
		status: 'planned',
		usedBy: ['landing rework'],
		source: 'ui',
	});

	// 6e. Equipment sets: 64 px sprites sliced from three sheets (public/pixel/__reuse/sets/<set>/<role>.png), one set per sheet row; `equipment-sets.json` says what belongs to which set.
	// A piece is `used` when it is wired as an item icon (`equipment-used.json`), else `unused`.
	const SET_ROLE: Record<string, { slot: string; weaponType?: string; group: string }> = {
		head: { slot: 'head', group: 'armor' },
		chest: { slot: 'chest', group: 'armor' },
		legs: { slot: 'legs', group: 'armor' },
		leg_guards: { slot: 'legs', group: 'armor' },
		shoulder: { slot: 'shoulder', group: 'armor' },
		hands: { slot: 'hands', group: 'armor' },
		feet: { slot: 'feet', group: 'armor' },
		belt: { slot: 'belt', group: 'accessories' },
		neck: { slot: 'neck', group: 'accessories' },
		mask: { slot: 'mask', group: 'accessories' },
		misc: { slot: 'misc', group: 'accessories' },
		gourd: { slot: 'consumable', group: 'accessories' },
	};
	const equipSets = JSON.parse(readFileSync(join(ROOT, 'scripts', 'assets', 'equipment-sets.json'), 'utf8')) as {
		id: string;
		name: string;
		theme: string;
		pieces: Record<string, string>;
	}[];
	const setUse = JSON.parse(readFileSync(join(ROOT, 'scripts', 'assets', 'equipment-used.json'), 'utf8')) as Record<string, string>;
	for (const s of equipSets)
		for (const [role, file] of Object.entries(s.pieces)) {
			const src = `/pixel/__reuse/sets/${s.id}/${file}`;
			const info = SET_ROLE[role] ?? { slot: role === 'knuckles' ? 'hands' : 'mainHand', weaponType: role, group: 'weapons' };
			const icon = setUse[src];
			add({
				name: `set_${s.id}_${role}`,
				category: 'sets',
				subcategory: `${s.theme}: ${s.name} (${info.group})`,
				src,
				status: icon ? 'used' : 'unused',
				usedBy: icon ? [icon] : [],
				slot: info.slot,
				weaponType: info.weaponType,
				source: `__reuse/sets/${s.id}`,
			});
		}

	// 6c. The second farm art set (200 px, isometric), waiting for the farm rework (IDL-346)
	for (const f of walk(join(PUBLIC, 'pixel', 'farm_rework')))
		add({
			name: `farm_rework_${snake(basename(f, '.png'))}`,
			category: 'map-details',
			subcategory: 'farm rework (planned)',
			src: url(f),
			status: 'planned',
			usedBy: ['Farm rework 2, IDL-346'],
			source: 'farm_rework',
		});

	// 7. Loose drops: pictures put into a folder before they were named or wired (unnamed Sprite Fusion files in enemies/ and the new pets/). They show under Unsorted cuts so each can be named, wired or deleted.
	const listedSrc = new Set(entries.flatMap((e) => [e.src, ...Object.values(e.variants ?? {})]));
	for (const dir of [join(PUBLIC, 'pixel', 'enemies'), join(PUBLIC, 'pixel', 'pets')])
		for (const f of walk(dir)) {
			if (listedSrc.has(url(f))) continue;
			const folder = relative(PUBLIC, dirname(f)).split(sep).join('/');
			add({
				name: `loose_${snake(folder.replace(/^pixel\//, ''))}_${snake(basename(f))
					.replace(/^sprite_fusion_/, 'sf_')
					.slice(0, 18)}`,
				category: 'unsorted',
				subcategory: `${folder} (not named by the code)`,
				src: url(f),
				status: 'reuse',
				source: folder,
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
	for (const e of entries) {
		const idol = IDOL_ART[e.src];
		if (idol) Object.assign(e, { name: idol, category: 'buildings', subcategory: 'idols (planned)', status: 'planned', usedBy: ['Idols, IDL-96'] });
	}
	// art picked for features that are not built yet
	for (const e of entries) {
		if (e.status === 'reuse' && e.name.startsWith('avatar_horned_'))
			Object.assign(e, { status: 'planned', usedBy: ['unlockable avatar (gems, achievements), IDL-266'] });
	}
	// The three tags. Art that code names by path or quoted file name is `used` whatever it was filed as; `planned` stays only while nothing names the picture; everything else (pool art, spares, alternatives, retired) is `unused`.
	// A placeholder is drawn in the game, so it is `used`.
	const codeText = srcFiles.map((f) => f.text).join('\n');
	for (const e of entries) {
		const stem = basename(e.src, '.png');
		const named =
			codeText.includes(e.src) ||
			(/^\/pixel\/(achievements|idols|pets|ui\/(heroes|biomes))\//.test(e.src) &&
				/[_-]/.test(stem) &&
				stem.length >= 8 &&
				new RegExp(`['"\`]${stem}['"\`]`).test(codeText));
		if (named && !e.usedBy.length) e.usedBy = ['code'];
		e.status = named || e.status === 'used' || e.status === 'placeholder' ? 'used' : e.status === 'planned' ? 'planned' : 'unused';
	}
	return entries.sort((a, b) => rank.get(a.category)! - rank.get(b.category)! || a.subcategory.localeCompare(b.subcategory) || a.name.localeCompare(b.name));
};
