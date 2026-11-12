import React from 'react';
import type { Rarity } from '../logic';
import { HoverTip, ResourceChip } from './primitives';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

export interface TipRow {
	label: string;
	value: React.ReactNode;
}
type Footer = [React.ReactNode, React.ReactNode];

/** Rows of "label ........ value". */
export const TipRows: React.FC<{ rows: TipRow[] }> = ({ rows }) => (
	<div className='ds-tip-rows'>
		{rows.map((r) => (
			<div className='ds-tip-row' key={r.label}>
				<span>{r.label}</span>
				<span>{r.value}</span>
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
}
/** The base tooltip: dark slate body, rim in the rarity colour, and a glow for uncommon and up. Icon + title header, free content, optional two-part footer. */
export const Tooltip: React.FC<TooltipProps> = ({ rarity = 'common', icon, title, subtitle, children, footer, className }) => (
	<div className={cx('ds-root', 'ds-tip', className)} data-rarity={rarity} role='tooltip'>
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

/** An item tooltip. `compare` shows the difference against the worn item. */
export const ItemTooltip: React.FC<{
	rarity: Rarity;
	icon: string;
	name: string;
	type: string;
	rows: TipRow[];
	flavor?: string;
	compareWith?: string;
	compare?: TipRow[];
	footer?: Footer;
}> = ({ rarity, icon, name, type, rows, flavor, compareWith, compare, footer }) => (
	<Tooltip rarity={rarity} icon={icon} title={name} subtitle={type} footer={footer}>
		<TipRows rows={rows} />
		{flavor ? <div className='ds-tip-note'>“{flavor}”</div> : null}
		{compare ? (
			<div className='ds-tip-compare'>
				<TipSection>vs worn · {compareWith}</TipSection>
				<TipRows rows={compare} />
			</div>
		) : null}
	</Tooltip>
);

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

/** A monster on the map: HP, damage, your odds, drops, bestiary progress. */
export const MonsterTooltip: React.FC<{ icon: string; name: string; subtitle: string; hp: string; rows: TipRow[]; drops: TipRow[]; footer?: Footer }> = ({
	icon,
	name,
	subtitle,
	hp,
	rows,
	drops,
	footer,
}) => (
	<Tooltip rarity='epic' icon={icon} title={name} subtitle={subtitle} footer={footer}>
		<TipRows rows={[{ label: 'HP', value: hp }]} />
		<div className='ds-bar' style={{ height: 10 }}>
			<div className='ds-bar-fill' style={{ width: '100%' }} />
		</div>
		<TipRows rows={rows} />
		<TipSection>Drops</TipSection>
		<TipRows rows={drops} />
	</Tooltip>
);

/** A building tile: output, upkeep and what the next level costs and pays back. */
export const BuildingTooltip: React.FC<{
	icon: string;
	name: string;
	subtitle: string;
	rows: TipRow[];
	nextLevel: number;
	next: TipRow[];
	footer?: Footer;
}> = ({ icon, name, subtitle, rows, nextLevel, next, footer }) => (
	<Tooltip rarity='rare' icon={icon} title={name} subtitle={subtitle} footer={footer}>
		<TipRows rows={rows} />
		<TipSection>Upgrade to level {nextLevel}</TipSection>
		<TipRows rows={next} />
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

/** A top-bar resource: the chip plus its hover tooltip (stock, income, sources). Props only; the caller supplies the live numbers. */
export const ResourceStat: React.FC<{ icon: string; name: string; value: string; rows: TipRow[]; sources?: TipRow[]; footer?: Footer }> = ({
	icon,
	name,
	value,
	rows,
	sources,
	footer,
}) => (
	<HoverTip tip={<ResourceTooltip icon={icon} name={name} rows={rows} sources={sources} footer={footer} />}>
		<ResourceChip icon={icon} value={value} />
	</HoverTip>
);
