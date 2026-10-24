import React, { useEffect, useRef, useState } from 'react';
import { FARM_BONUS, FarmCritterType } from '@/config/gameConfig';
import type { ClickInput } from '@/types/game';
import { PixelIconName } from '@/config/pixelIcons';
import { PEN } from './farmGeometry';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';

// Static scenery around the pen: sprite, anchor (bottom-centre) as % of the stage
const DECOR: { name: PixelIconName; x: number; y: number }[] = [
	{ name: 'meadow_tree', x: 7, y: 40 },
	{ name: 'meadow_pine', x: 94, y: 36 },
	{ name: 'meadow_pine', x: 86, y: 18 },
	{ name: 'meadow_bush', x: 24, y: 12 },
	{ name: 'meadow_stump', x: 40, y: 9 },
	{ name: 'meadow_mushrooms', x: 12, y: 20 },
	{ name: 'meadow_bush', x: 68, y: 10 },
	{ name: 'meadow_flowers', x: 55, y: 7 },
	{ name: 'meadow_tree', x: 91, y: 92 },
	{ name: 'meadow_pond', x: 80, y: 95 },
	{ name: 'meadow_flowers', x: 22, y: 94 },
	{ name: 'meadow_rocks', x: 40, y: 96 },
	{ name: 'meadow_pine', x: 7, y: 90 },
	{ name: 'meadow_mushrooms', x: 62, y: 96 },
	{ name: 'meadow_flowers', x: 6, y: 62 },
	{ name: 'meadow_rocks', x: 95, y: 62 },
];

/** Static meadow scenery; sits behind the pen and never takes clicks. */
export const MeadowDecor: React.FC = () => (
	<div className='meadow-decor' aria-hidden>
		{DECOR.map((d, i) => (
			<span key={i} className='meadow-prop' style={{ left: `${d.x}%`, top: `${d.y}%`, zIndex: Math.round(d.y) }}>
				<PixelIcon name={d.name} scale={2} />
			</span>
		))}
	</div>
);

// sheet = 2 frames (flap / hop), frame size in native px
export const CRITTER_SHEETS: Record<FarmCritterType, { name: string; w: number; h: number; ms: number }> = {
	butterfly: { name: 'bonus_butterfly', w: 28, h: 28, ms: 320 },
	bee: { name: 'bonus_bee', w: 28, h: 26, ms: 140 },
	ladybug: { name: 'bonus_ladybug', w: 24, h: 22, ms: 500 },
	rabbit: { name: 'bonus_rabbit', w: 34, h: 34, ms: 520 },
};

export interface Critter {
	id: number;
	type: FarmCritterType;
	golden: boolean;
	x: number;
	y: number;
	dx: number;
	dy: number;
	flip: boolean;
}

let nextId = 1;

/** Pick a spot in the meadow, preferably outside the pen (the scene fills the window, so the margin can be thin). */
const pickSpot = (w: number, h: number, zoom: number) => {
	const penW = PEN.w * zoom * 0.5 + 24;
	const penH = PEN.h * zoom * 0.5;
	const spot = () => ({
		x: 36 + Math.random() * Math.max(10, w - 72),
		y: 50 + Math.random() * Math.max(10, h - 90),
	});
	for (let i = 0; i < 40; i++) {
		const p = spot();
		if (Math.abs(p.x - w / 2) > penW || Math.abs(p.y - h / 2) > penH) return p;
	}
	return spot(); // no meadow left: it flutters over the pen instead
};

const pickType = (): FarmCritterType => {
	const entries = Object.entries(FARM_BONUS.critters) as [FarmCritterType, { weight: number }][];
	let roll = Math.random() * entries.reduce((a, [, c]) => a + c.weight, 0);
	for (const [type, c] of entries) {
		roll -= c.weight;
		if (roll <= 0) return type;
	}
	return 'butterfly';
};

export const makeCritter = (w: number, h: number, zoom: number): Critter => {
	const { x, y } = pickSpot(w, h, zoom);
	return {
		id: nextId++,
		type: pickType(),
		golden: Math.random() < FARM_BONUS.goldenChance,
		x,
		y,
		dx: Math.round((Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 60)),
		dy: Math.round((Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 35)),
		flip: Math.random() < 0.5,
	};
};

/** Spawns critters on a timer while mounted and removes each after FARM_BONUS.lifetimeMs. */
export const useMeadowCritters = (stage: React.RefObject<HTMLDivElement | null>, zoom: React.RefObject<number>) => {
	const [critters, setCritters] = useState<Critter[]>([]);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const schedule = (delay: number) => {
			timer = setTimeout(() => {
				const el = stage.current;
				if (el) {
					setCritters((prev) =>
						prev.length >= FARM_BONUS.maxActive
							? prev
							: [...prev, makeCritter(el.clientWidth, el.clientHeight, zoom.current)]
					);
				}
				schedule(FARM_BONUS.minGapMs + Math.random() * (FARM_BONUS.maxGapMs - FARM_BONUS.minGapMs));
			}, delay);
		};
		schedule(FARM_BONUS.firstDelayMs);
		return () => clearTimeout(timer);
	}, [stage, zoom]);

	const remove = (id: number) => setCritters((prev) => prev.filter((c) => c.id !== id));
	return { critters, remove };
};

interface MeadowCritterProps {
	critter: Critter;
	onCatch: (critter: Critter, x: number, y: number, input: ClickInput) => void;
	onExpire: (id: number) => void;
}

/** One bonus critter: wanders about for 10 seconds (blinking at the end) and gives a gift when clicked. */
export const MeadowCritter: React.FC<MeadowCritterProps> = ({ critter, onCatch, onExpire }) => {
	const scale = 2; // critters keep their size whatever the pen zoom
	const sheet = CRITTER_SHEETS[critter.type];
	const gift = FARM_BONUS.critters[critter.type].resource;
	const caught = useRef(false);

	useEffect(() => {
		const t = setTimeout(() => {
			if (!caught.current) onExpire(critter.id);
		}, FARM_BONUS.lifetimeMs);
		return () => clearTimeout(t);
	}, [critter.id, onExpire]);

	return (
		<div
			className='meadow-critter'
			data-type={critter.type}
			data-golden={critter.golden}
			style={
				{
					left: critter.x,
					top: critter.y,
					'--dx': `${critter.dx}px`,
					'--dy': `${critter.dy}px`,
					'--f': critter.flip ? -1 : 1,
					'--life': `${FARM_BONUS.lifetimeMs}ms`,
				} as React.CSSProperties
			}>
			<div
				className='mc-move'
				role='button'
				aria-label={`${FARM_BONUS.critters[critter.type].label} - click for a gift`}
				onClick={(e) => {
					// Gifts are for real clicks only (a script cannot farm the meadow)
					if (caught.current || !e.isTrusted) return;
					caught.current = true;
					onCatch(critter, e.clientX, e.clientY, {
						eventId: e.nativeEvent.timeStamp,
						now: performance.now(),
						trusted: e.nativeEvent.isTrusted,
					});
					onExpire(critter.id);
				}}>
				<span className='mc-gift'>
					<ResourceIcon resource={gift} />
					{critter.golden && <b>x{FARM_BONUS.goldenMultiplier}</b>}
				</span>
				<span
					className='mc-sprite'
					style={
						{
							width: sheet.w * scale,
							height: sheet.h * scale,
							backgroundImage: `url('/pixel/icons/${sheet.name}.png')`,
							backgroundSize: `${sheet.w * 2 * scale}px ${sheet.h * scale}px`,
							'--sheet-w': `${sheet.w * 2 * scale}px`,
							'--frame-ms': `${sheet.ms}ms`,
						} as React.CSSProperties
					}
				/>
				<span className='mc-timer'>
					<i />
				</span>
			</div>
		</div>
	);
};
