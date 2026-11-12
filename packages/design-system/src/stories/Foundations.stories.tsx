import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DsRoot } from '../index';

const meta = {
	title: 'Design System/Foundations',
	parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const swatches = [
	'--ds-slate',
	'--ds-slate-2',
	'--ds-gold',
	'--ds-gold-lt',
	'--ds-wood',
	'--ds-wood-dk',
	'--ds-parch',
	'--ds-good',
	'--ds-bad',
	'--ds-mana',
	'--ds-r-uncommon',
	'--ds-r-rare',
	'--ds-r-epic',
	'--ds-r-legendary',
];
const art = [
	'frame-stone',
	'frame-stone-b',
	'frame-panel',
	'frame-slot',
	'plaque-wood',
	'plaque-wood-ornate',
	'bar-stone',
	'btn-gold',
	'btn-wood',
	'btn-stone',
	'tab-idle',
	'tab-active',
	'divider-gold',
	'divider-flourish',
	'divider-fleur',
	'corner-gold',
	'emblem-shield',
	'banner-navy',
	'banner-red',
	'scroll',
	'tex-slate',
	'tex-parchment',
	'tex-wood',
	'tex-wood-dark',
];

/** Colour tokens (all CSS variables under `.ds-root`). */
export const Palette: Story = {
	render: () => (
		<DsRoot style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#0b1022' }}>
			{swatches.map((s) => (
				<div key={s} style={{ width: 120 }}>
					<div style={{ height: 48, background: `var(${s})`, border: '2px solid #000' }} />
					<code style={{ fontSize: 11 }}>{s}</code>
				</div>
			))}
		</DsRoot>
	),
};

/** The art pieces cut from the UI kit sheet (clean slate texture is generated), shown 3x. */
export const Art: Story = {
	render: () => (
		<DsRoot style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: 20, background: '#2a2d3a', alignItems: 'flex-end' }}>
			{art.map((a) => (
				<figure key={a} style={{ margin: 0 }}>
					<img src={new URL(`../assets/${a}.png`, import.meta.url).href} alt={a} style={{ imageRendering: 'pixelated', zoom: 3 }} />
					<figcaption style={{ fontSize: 11 }}>{a}</figcaption>
				</figure>
			))}
		</DsRoot>
	),
};
