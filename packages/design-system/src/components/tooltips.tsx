import React from 'react';
import { tidy, type Rarity } from '../logic';
import { HoverTip, ResourceChip } from './primitives';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/** Colours a tooltip line may take: gold (emphasis), purple (the castle), amber (a timer or a discount), green and red (good and bad), blue (an affix), muted (grey help text). */
export type TipTone = 'gold' | 'purple' | 'amber' | 'green' | 'red' | 'blue' | 'muted';

export interface TipRow {
	label: string;
	value: React.ReactNode;
	/** Colours the whole row */
	tone?: TipTone;
}
type Footer = [React.ReactNode, React.ReactNode];

/** Rows of "label ........ value". */
export const TipRows: React.FC<{ rows: TipRow[] }> = ({ rows }) => (
	<div className='ds-tip-rows'>
		{rows.map((r) => (
			<div className='ds-tip-row' data-tone={r.tone} key={r.label}>
				<span>{r.label}</span>
				<span>{r.value}</span>
			</div>
		))}
	</div>
);

/** One free line of text in a tone ("Castle area: +20% production", "Upgrading to level 3: 4m left"). */
export const TipLine: React.FC<{ tone?: TipTone; children: React.ReactNode }> = ({ tone = 'muted', children }) => (
	<div className='ds-tip-line' data-tone={tone}>
		{children}
	</div>
);

/**
 * A number with its change against something (the worn item, the item after a swap): `+12` in green when it is better, `-3` in red when worse. `lowerIsBetter` flips the colours (attack interval, cost).
 * Pass `value` as the text of the number itself and `diff` as the signed change; a zero or missing diff shows nothing.
 */
export const TipDiff: React.FC<{ value: React.ReactNode; diff?: number; lowerIsBetter?: boolean; digits?: number }> = ({
	value,
	diff,
	lowerIsBetter,
	digits = 0,
}) => {
	const shown = diff !== undefined && Math.abs(diff) > 10 ** -(digits + 1);
	const good = shown && (lowerIsBetter ? diff! < 0 : diff! > 0);
	return (
		<span className='ds-tip-diffval'>
			{value}
			{shown ? (
				<span className='ds-tip-diff' data-tone={good ? 'green' : 'red'}>
					{' '}
					({diff! > 0 ? '+' : ''}
					{tidy(diff!.toFixed(digits))})
				</span>
			) : null}
		</span>
	);
};

export interface TipCost {
	label: string;
	icon?: string;
	/** What the player has and what it costs, as numbers (the colour follows) and as shown text */
	have: number;
	cost: number;
	text?: string;
	/** An amber "(-12%)" next to the cost */
	discount?: string;
}

/** A list of costs: green when the player can pay, red when not, with an amber discount note. */
export const TipCostList: React.FC<{ costs: TipCost[] }> = ({ costs }) => (
	<div className='ds-tip-rows'>
		{costs.map((c) => (
			<div className='ds-tip-row' key={c.label} data-tone={c.have >= c.cost ? 'green' : 'red'}>
				<span>
					{c.icon ? <img className='ds-tip-mini' src={c.icon} alt='' /> : null}
					{c.label}
				</span>
				<span>
					{c.text ?? c.cost}
					{c.discount ? <span className='ds-tip-discount'> ({c.discount})</span> : null}
				</span>
			</div>
		))}
	</div>
);

export interface TipSetBlockProps {
	/** "Cloudwalker set (3/5)" */
	title: string;
	pieces: { name: string; worn: boolean }[];
	bonuses: { count: number; text: string; active: boolean }[];
}
/** The set block of an item: the pieces (gold when worn, grey when not) and the bonus lines (green when active). */
export const TipSetBlock: React.FC<TipSetBlockProps> = ({ title, pieces, bonuses }) => (
	<div className='ds-tip-set'>
		<div className='ds-tip-set-title'>{title}</div>
		{pieces.map((p) => (
			<div key={p.name} className='ds-tip-set-piece' data-worn={p.worn}>
				{p.name}
			</div>
		))}
		{bonuses.map((b) => (
			<div key={b.count} className='ds-tip-set-bonus' data-active={b.active}>
				({b.count}) {b.text}
			</div>
		))}
	</div>
);

/** Gold small-caps divider inside a tooltip ("DROPS", "UPGRADE TO LEVEL 4"). */
export const TipSection: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className='ds-tip-section'>{children}</div>;

export interface TooltipProps {
	rarity?: Rarity;
	icon?: string;
	title: string;
	subtitle?: React.ReactNode;
	children?: React.ReactNode;
	footer?: Footer;
	className?: string;
	/** A solid band across the top of the card ("Equipped" in green, "Comparing" in grey) */
	banner?: { text: string; tone: 'equipped' | 'comparing' };
}
/** The base tooltip: dark slate body, rim in the rarity colour, and a glow for uncommon and up. Icon + title header, free content, optional two-part footer. */
export const Tooltip: React.FC<TooltipProps> = ({ rarity = 'common', icon, title, subtitle, children, footer, className, banner }) => (
	<div className={cx('ds-root', 'ds-tip', className)} data-rarity={rarity} role='tooltip'>
		{banner ? (
			<div className='ds-tip-banner' data-tone={banner.tone}>
				{banner.text}
			</div>
		) : null}
		<div className='ds-tip-head'>
			{icon ? <img src={icon} alt='' /> : null}
			<div>
				<div className='ds-tip-title'>{title}</div>
				{subtitle ? <div className='ds-tip-sub'>{subtitle}</div> : null}
			</div>
		</div>
		{children}
		{footer ? (
			<div className='ds-tip-foot'>
				<span>{footer[0]}</span>
				<span>{footer[1]}</span>
			</div>
		) : null}
	</div>
);

export interface ItemStatGroup {
	/** The coloured heading ("Offence", "Defence", "Utility") */
	heading: string;
	rows: TipRow[];
}

export interface ItemTooltipProps {
	rarity: Rarity;
	icon: string;
	name: string;
	/** "Rare sword - Main hand" or "Consumable" */
	type: string;
	/** Item level, quality and whether it was crafted: "Item Level 24 - Quality 87% - Crafted" */
	levelLine?: string;
	/** The big headline number (damage, armor) with its change against the worn piece */
	primary?: { label: string; value: string; diff?: number };
	/** The attack speed and DPS lines of a weapon, each with its change */
	speed?: { label: string; value: string; diff?: number; lowerIsBetter?: boolean }[];
	rows?: TipRow[];
	/** Stats grouped under coloured headings */
	groups?: ItemStatGroup[];
	/** Affix lines (blue), each "+12 Fire damage" with the affix name */
	affixes?: { text: string; name: string }[];
	/** Properties the worn piece has and this one lacks */
	lost?: string[];
	/** Set changes when it replaces a worn piece: "Cloudwalker 2 -> 3 / 5" */
	setChanges?: { label: string; from: number; to: number; size: number }[];
	set?: TipSetBlockProps;
	flavor?: string;
	/** The story of a legendary, two lines in the card */
	lore?: string;
	/** Marks the card of the piece currently worn ("Equipped") */
	equippedLabel?: boolean;
	/** A solid band over the card: green "Equipped" for the worn piece, grey "Comparing" for the hovered one */
	banner?: { text: string; tone: 'equipped' | 'comparing' };
	/** The difference block: what changes against the worn piece, one row per change (tone green for a gain, red for a loss), under the heading `compareWith` (default "Difference") */
	compareWith?: string;
	compare?: TipRow[];
	/** Shows the Drink button of a potion */
	onDrink?: () => void;
	/** The key hints line: a key cap and what it does (`{ key: 'Dbl-click', text: 'equip' }`), or plain text */
	hints?: string | { key: string; text: string }[];
	/** Anything more, drawn after the set changes (the gained and lost set bonuses, the net change) */
	extra?: React.ReactNode;
	footer?: Footer;
}

/**
 * An item tooltip with everything the game's card shows: kind line, item level and quality, the primary stat with its change, attack speed and DPS, stats grouped by colour, blue affix lines, lost properties, set changes and the set block,
 * flavour and lore, the sell or buy price footer, a Drink button and a key hints line. Every part is optional.
 */
export const ItemTooltip: React.FC<ItemTooltipProps> = ({
	rarity,
	icon,
	name,
	type,
	levelLine,
	primary,
	speed,
	rows,
	groups,
	affixes,
	lost,
	setChanges,
	set,
	flavor,
	lore,
	equippedLabel,
	banner,
	compareWith,
	compare,
	onDrink,
	hints,
	extra,
	footer,
}) => (
	<Tooltip rarity={rarity} icon={icon} title={name} subtitle={type} footer={footer} banner={banner}>
		{equippedLabel ? <div className='ds-tip-equipped'>Equipped</div> : null}
		{levelLine ? <TipLine tone='muted'>{levelLine}</TipLine> : null}
		{primary ? (
			<div className='ds-tip-primary'>
				<TipDiff value={primary.value} diff={primary.diff} /> <span>{primary.label}</span>
			</div>
		) : null}
		{speed?.map((r) => (
			<div className='ds-tip-row' key={r.label}>
				<span>{r.label}</span>
				<TipDiff value={r.value} diff={r.diff} lowerIsBetter={r.lowerIsBetter} digits={2} />
			</div>
		))}
		{rows ? <TipRows rows={rows} /> : null}
		{groups?.map((g) => (
			<div key={g.heading} className='ds-tip-group'>
				<div className='ds-tip-group-head'>{g.heading}</div>
				<TipRows rows={g.rows} />
			</div>
		))}
		{affixes?.map((a) => (
			<TipLine key={a.name + a.text} tone='blue'>
				{a.text} <span className='ds-tip-affix'>{a.name}</span>
			</TipLine>
		))}
		{lost && lost.length > 0 ? (
			<div className='ds-tip-lost'>
				<TipSection>Properties lost when equipped</TipSection>
				{lost.map((l) => (
					<TipLine key={l} tone='red'>
						{l}
					</TipLine>
				))}
			</div>
		) : null}
		{setChanges?.map((c) => (
			<TipLine key={c.label} tone={c.to >= c.from ? 'green' : 'red'}>
				{c.label} {c.from} → {c.to} / {c.size}
			</TipLine>
		))}
		{extra}
		{set ? <TipSetBlock {...set} /> : null}
		{onDrink ? (
			<button type='button' className='ds-btn ds-btn-sm' onClick={onDrink}>
				Drink
			</button>
		) : null}
		{flavor ? <div className='ds-tip-note'>“{flavor}”</div> : null}
		{lore ? (
			<div className='ds-tip-note ds-tip-lore' title={lore}>
				{lore}
			</div>
		) : null}
		{compare ? (
			<div className='ds-tip-compare'>
				<div className='ds-tip-compare-head'>{compareWith ?? 'Difference'}</div>
				<TipRows rows={compare} />
			</div>
		) : null}
		{Array.isArray(hints) ? (
			<div className='ds-tip-keys'>
				{hints.map((h) => (
					<span key={h.key + h.text}>
						<span className='ds-kbd'>{h.key}</span>
						{h.text}
					</span>
				))}
			</div>
		) : hints ? (
			<TipLine tone='muted'>{hints}</TipLine>
		) : null}
	</Tooltip>
);

/** The two cards of a bag item: the hovered one and, next to it, the piece worn in the same slot (marked Equipped). Put two `ItemTooltip`s in it. */
export const TooltipStack: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className='ds-tip-stack'>{children}</div>;

/** A resource in the top bar: stock, income, where it comes from. */
export const ResourceTooltip: React.FC<{ icon: string; name: string; rows: TipRow[]; sources?: TipRow[]; footer?: Footer }> = ({
	icon,
	name,
	rows,
	sources,
	footer,
}) => (
	<Tooltip rarity='common' className='ds-tip-compact' icon={icon} title={name} subtitle='Base material' footer={footer}>
		<TipRows rows={rows} />
		{sources ? (
			<>
				<TipSection>Sources</TipSection>
				<TipRows rows={sources} />
			</>
		) : null}
	</Tooltip>
);

/**
 * A monster on the map: HP, damage, your odds, drops, bestiary progress, and the game's extra lines: BOSS mark, kills so far, how it grows ("Level 12 of 20, grows in 8 min" or "fully grown"), the boss line (crits, stun resist, the time
 * limit), a call to action (fight, add to the queue, in the queue) and the art-preview note.
 */
export const MonsterTooltip: React.FC<{
	icon: string;
	name: string;
	subtitle: string;
	hp: string;
	rows: TipRow[];
	drops: TipRow[];
	footer?: Footer;
	boss?: boolean;
	defeated?: number;
	growth?: string;
	bossLine?: string;
	cta?: string;
	wip?: boolean;
}> = ({ icon, name, subtitle, hp, rows, drops, footer, boss, defeated, growth, bossLine, cta, wip }) => (
	<Tooltip rarity={boss ? 'legendary' : 'epic'} icon={icon} title={name} subtitle={subtitle} footer={footer}>
		{boss ? <div className='ds-tip-boss'>BOSS</div> : null}
		<TipRows rows={[{ label: 'HP', value: hp }]} />
		<div className='ds-bar' style={{ height: 10 }}>
			<div className='ds-bar-fill' style={{ width: '100%' }} />
		</div>
		<TipRows rows={rows} />
		{defeated !== undefined ? <TipLine tone='muted'>Defeated: {defeated}</TipLine> : null}
		{growth ? <TipLine tone='amber'>{growth}</TipLine> : null}
		{bossLine ? <TipLine tone='red'>{bossLine}</TipLine> : null}
		<TipSection>Drops</TipSection>
		<TipRows rows={drops} />
		{cta ? <TipLine tone='gold'>{cta}</TipLine> : null}
		{wip ? <TipLine tone='muted'>Work in progress: art preview only</TipLine> : null}
	</Tooltip>
);

/** A building tile: output, upkeep and what the next level costs and pays back, plus the biome bonus, the idol text, the rebirth note and the call to action. */
export const BuildingTooltip: React.FC<{
	icon: string;
	name: string;
	subtitle: string;
	rows: TipRow[];
	nextLevel: number;
	next: TipRow[];
	footer?: Footer;
	/** "Forest bonus: +12% (owned tiles)" */
	biomeBonus?: string;
	/** The Idol text, with "(coming soon: not applied yet)" when it is not live */
	idolText?: string;
	/** "Its level is kept when you rebirth; rebuild it free" */
	rebirthNote?: string;
	cta?: string;
}> = ({ icon, name, subtitle, rows, nextLevel, next, footer, biomeBonus, idolText, rebirthNote, cta }) => (
	<Tooltip rarity='rare' icon={icon} title={name} subtitle={subtitle} footer={footer}>
		<TipRows rows={rows} />
		{biomeBonus ? <TipLine tone='green'>{biomeBonus}</TipLine> : null}
		{idolText ? <TipLine tone='purple'>{idolText}</TipLine> : null}
		<TipSection>Upgrade to level {nextLevel}</TipSection>
		<TipRows rows={next} />
		{rebirthNote ? <TipLine tone='muted'>{rebirthNote}</TipLine> : null}
		{cta ? <TipLine tone='gold'>{cta}</TipLine> : null}
	</Tooltip>
);

export interface TileResourceRow {
	icon: string;
	name: string;
	/** What the tile makes itself and the green bonus on top, per second, as shown text */
	own: string;
	bonus?: string;
}

/**
 * A tile on the map. Owned: biome, per-resource output with the green bonus, the adjacency bonus, the purple castle lines and an amber upgrade timer. Unexplored (`unexplored`): "Unexplored Land", the cost list with the discount and
 * "Click to explore".
 */
export const TileTooltip: React.FC<{
	icon: string;
	name: string;
	castleLevel?: number;
	resources?: TileResourceRow[];
	adjacency?: string;
	castleLines?: string[];
	upgrading?: string;
	unexplored?: boolean;
	costs?: TipCost[];
	cta?: string;
	footer?: Footer;
}> = ({ icon, name, castleLevel, resources, adjacency, castleLines, upgrading, unexplored, costs, cta, footer }) => (
	<Tooltip
		rarity='common'
		icon={icon}
		title={unexplored ? 'Unexplored Land' : name}
		subtitle={castleLevel ? <span className='ds-tip-castle'>Level {castleLevel} Castle</span> : undefined}
		footer={footer}
	>
		{resources?.map((r) => (
			<div className='ds-tip-row' key={r.name}>
				<span>
					<img className='ds-tip-mini' src={r.icon} alt='' />
					{r.name}
				</span>
				<span>
					{r.own}
					{r.bonus ? (
						<span className='ds-tip-diff' data-tone='green'>
							{' '}
							{r.bonus}
						</span>
					) : null}
				</span>
			</div>
		))}
		{adjacency ? <TipLine tone='green'>{adjacency}</TipLine> : null}
		{castleLines?.map((l) => (
			<TipLine key={l} tone='purple'>
				{l}
			</TipLine>
		))}
		{upgrading ? <TipLine tone='amber'>{upgrading}</TipLine> : null}
		{unexplored && costs ? (
			<>
				<TipSection>Cost</TipSection>
				<TipCostList costs={costs} />
			</>
		) : null}
		{cta ? <TipLine tone='gold'>{cta}</TipLine> : null}
	</Tooltip>
);

/** A chest standing on the map: what it may hold and how to open it. */
export const ChestTooltip: React.FC<{ icon: string; rows?: TipRow[]; cta?: string }> = ({ icon, rows, cta = 'Click to open' }) => (
	<Tooltip rarity='uncommon' icon={icon} title='Treasure chest' subtitle='Opens with a click'>
		{rows ? <TipRows rows={rows} /> : null}
		<TipLine tone='gold'>{cta}</TipLine>
	</Tooltip>
);

/** One bold line and one grey line, no icon. For buttons and short hints. */
export const HintTooltip: React.FC<{ title: string; text?: string; tone?: 'normal' | 'bad' }> = ({ title, text, tone = 'normal' }) => (
	<div className='ds-root ds-tip ds-tip-hint' role='tooltip' style={{ ['--ds-rim' as string]: tone === 'bad' ? '#c7503f' : '#9a7424' }}>
		<div style={{ fontSize: 14, color: tone === 'bad' ? '#ff8d7c' : '#fff' }}>{title}</div>
		{text ? (
			<div className='ds-tip-sub' style={{ marginTop: 3 }}>
				{text}
			</div>
		) : null}
	</div>
);

/** A top-bar resource: the chip plus its hover tooltip (stock, income, sources). Props only; the caller supplies the live numbers. `chip` makes the chip a button and carries its extra attributes. */
export const ResourceStat: React.FC<{
	icon: string;
	name: string;
	value: string;
	rows: TipRow[];
	sources?: TipRow[];
	footer?: Footer;
	chip?: { onClick?: () => void; title?: string } & Record<`data-${string}`, string | undefined>;
}> = ({ icon, name, value, rows, sources, footer, chip }) => (
	<HoverTip tip={<ResourceTooltip icon={icon} name={name} rows={rows} sources={sources} footer={footer} />}>
		<ResourceChip icon={icon} value={value} {...chip} />
	</HoverTip>
);
