/**
 * The shape of the generated reference: which top-level categories exist, in which order, and the convention text that opens docs/reference/README.md.
 * A `@category` whose first segment is not listed here fails `npm run docs:code`, so the structure cannot drift by typo.
 */
export interface CategoryDef {
	/** The first segment of `@category` */
	name: string;
	/** File name without extension */
	slug: string;
	blurb: string;
	/** Order of the sections (the second `@category` segment); sections not listed follow in the order they appear */
	sections?: string[];
}

export const CATEGORIES: CategoryDef[] = [
	{ name: 'Overview', slug: 'overview', blurb: 'What the game is and how the loop fits together.', sections: ['The game'] },
	{
		name: 'Economy',
		slug: 'economy',
		blurb: 'Income, tiles, buildings, castle, farm, merchant, clicks, chests and Luck.',
		sections: ['Basics', 'Income', 'Tiles', 'Biomes', 'Buildings', 'Castle', 'Farm', 'Merchant', 'Clicks', 'Chests and Luck'],
	},
	{
		name: 'Combat',
		slug: 'combat',
		blurb: "The player's numbers, the server's fight engine, auto-battle, skills and win chance.",
		sections: ['Overview', 'Player numbers', 'A fight', 'Win chance', 'Potions and skills', 'Results and rest'],
	},
	{ name: 'Monsters', slug: 'monsters', blurb: 'The roster, levels, growth, spawning and what a kill pays.', sections: ['Roster', 'Level scaling', 'Spawning', 'Rewards'] },
	{
		name: 'Loot',
		slug: 'loot',
		blurb: 'The loot pipeline, rarities, affixes, sets, sell values and how to add content.',
		sections: ['Pipeline', 'Config', 'Items', 'Adding content'],
	},
	{
		name: 'Progression',
		slug: 'progression',
		blurb: 'Levels, attributes, skills, rebirth, Embers, limits and gems.',
		sections: ['Levels', 'Attributes', 'Rebirth', 'Ember shop', 'Limits', 'Gems', 'Crafting'],
	},
	{
		name: 'Saves & Server',
		slug: 'saves-and-server',
		blurb: 'The save, cloud-save checks, the ledger, sealed rolls, away time and the threat model.',
		sections: ['Threat model', 'The save', 'Uploading', 'Accepting a save', 'The ledger', 'Endpoints', 'Away time'],
	},
	{
		name: 'Architecture',
		slug: 'architecture',
		blurb: 'Stack, state, the tick loop, the map, rendering and the art pipeline.',
		sections: ['The loop', 'State', 'Rendering', 'Art'],
	},
	{ name: 'Pacing', slug: 'pacing', blurb: 'The pace the economy is tuned for, and the bot simulation that checks it.', sections: ['Targets', 'Magnitude targets', 'The sim'] },
	{ name: 'Ops', slug: 'ops', blurb: 'Commands, CI, the pacing guard, season resets and the E2E test account.', sections: ['Commands', 'CI', 'Operator guides'] },
];

export const REFERENCE_INTRO = `# Reference: generated from the code's JSDoc

**This folder is generated. Do not edit it.** It is rebuilt from the JSDoc blocks that sit next to the code by \`npm run docs:code\`, and a git pre-commit
hook (\`.githooks/pre-commit\`) runs that for every commit. The JSDoc in \`src/\`, \`scripts/\`, \`e2e/\` is the **single source of truth** for how the game works;
the planning documents in \`docs/plan/\` (ROADMAP, RELEASE-PLAN, drafts) are the only hand-written docs left, because they describe what is *not built*.

Open [index.html](index.html) for the searchable version, or read the Markdown pages below. [symbols.md](symbols.md) maps every documented function to its
file and line; [reference.json](reference.json) is the same data for tools; [code-map.md](code-map.md) lists every source file with its first comment.

## How to document something

Write a JSDoc block directly above the function, constant or type that implements the rule, and add \`@category\`:

\`\`\`ts
/**
 * Gold price of the next tile. One sentence a human or an agent can read first.
 *
 * Any markdown prose: rules, why, edge cases. Name other documented symbols with {@link calculateTileCost}.
 *
 * @category Economy/Tiles
 * @formula
 * price(n) = floor(55 x 1.13^min(m,15) x ...)
 * @example price(10) = 186
 * @table tile-price-examples
 * @see calculateTileCost
 * @knownissue IDL-221 what is wrong and what decides it
 */
export const tilePrice = ...
\`\`\`

| Tag | Meaning |
| --- | --- |
| \`@category Top/Sub\` | **Required.** \`Top\` is one of the categories below, \`Sub\` is the section inside its page (free text, created on first use). |
| \`@title Text\` | Only for a free-standing topic: a block with no declaration under it (a rule that spans several functions, the threat model, a file overview). |
| \`@formula\` | A multi-line formula or rule table, rendered as a code block. |
| \`@example\` | A worked example, rendered as a code block. Prefer \`@table\` for numbers: a table is computed from the real code and cannot go stale. |
| \`@table id\` | Embeds a table computed from the live config by \`scripts/docs/tables.ts\` (add the id there). |
| \`@see a, b\` | Related symbols or files. A documented symbol becomes a link. |
| \`@knownissue text\` | An open code-side finding. Collected on [known-issues.md](known-issues.md). |
| \`@order n\` | Sort position inside its section (default: file order). |
| \`{@link name}\` | In prose, a link to another documented symbol. |

Rules: describe what the code does *now*, not plans (plans go in \`docs/plan/\`); never repeat a number the config holds in a long list, use \`@table\`;
when the code changes, change the block in the same edit. \`tests/docs/reference.test.ts\` fails when the committed reference is stale.

## Pages
`;
