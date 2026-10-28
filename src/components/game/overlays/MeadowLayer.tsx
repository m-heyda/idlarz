import React, { useEffect, useState } from 'react';
import { FARM_CRITTERS, FarmCritterType } from '@/config/gameConfig';
import type { Insets } from './farmGeometry';

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
	x: number;
	y: number;
	dx: number;
	dy: number;
	flip: boolean;
}

let nextId = 1;

/** Pick a spot on the meadow that is not under a panel or the stats readout in the top-left corner (so it stays in view). */
const pickSpot = (w: number, h: number, insets: Insets) => {
	const spot = () => ({
		x: 36 + Math.random() * Math.max(10, w - insets.right - 90),
		y: 50 + Math.random() * Math.max(10, h - insets.bottom - 110),
	});
	for (let i = 0; i < 40; i++) {
		const p = spot();
		if (p.x > 290 || p.y > 270) return p;
	}
	return spot();
};

const pickType = (): FarmCritterType => {
	const entries = Object.entries(FARM_CRITTERS.critters) as [FarmCritterType, { weight: number }][];
	let roll = Math.random() * entries.reduce((a, [, c]) => a + c.weight, 0);
	for (const [type, c] of entries) {
		roll -= c.weight;
		if (roll <= 0) return type;
	}
	return 'butterfly';
};

export const makeCritter = (w: number, h: number, insets: Insets): Critter => {
	const { x, y } = pickSpot(w, h, insets);
	return {
		id: nextId++,
		type: pickType(),
		x,
		y,
		dx: Math.round((Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 60)),
		dy: Math.round((Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 35)),
		flip: Math.random() < 0.5,
	};
};

/** Spawns critters on a timer while mounted; each leaves again after FARM_CRITTERS.lifetimeMs. */
export const useMeadowCritters = (stage: React.RefObject<HTMLDivElement | null>, insets: React.RefObject<Insets>) => {
	const [critters, setCritters] = useState<Critter[]>([]);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const schedule = (delay: number) => {
			timer = setTimeout(() => {
				const el = stage.current;
				if (el) {
					setCritters((prev) =>
						prev.length >= FARM_CRITTERS.maxActive
							? prev
							: [...prev, makeCritter(el.clientWidth, el.clientHeight, insets.current)]
					);
				}
				schedule(FARM_CRITTERS.minGapMs + Math.random() * (FARM_CRITTERS.maxGapMs - FARM_CRITTERS.minGapMs));
			}, delay);
		};
		schedule(FARM_CRITTERS.firstDelayMs);
		return () => clearTimeout(timer);
	}, [stage, insets]);

	const remove = (id: number) => setCritters((prev) => prev.filter((c) => c.id !== id));
	return { critters, remove };
};

interface MeadowCritterProps {
	critter: Critter;
	onExpire: (id: number) => void;
}

/** One meadow critter: wanders about for 10 seconds (blinking at the end) and leaves. Decoration only: it takes no clicks. */
export const MeadowCritter: React.FC<MeadowCritterProps> = ({ critter, onExpire }) => {
	const scale = 2; // critters keep their size whatever the pen zoom
	const sheet = CRITTER_SHEETS[critter.type];

	useEffect(() => {
		const t = setTimeout(() => onExpire(critter.id), FARM_CRITTERS.lifetimeMs);
		return () => clearTimeout(t);
	}, [critter.id, onExpire]);

	return (
		<div
			className='meadow-critter'
			data-type={critter.type}
			style={
				{
					left: critter.x,
					top: critter.y,
					'--dx': `${critter.dx}px`,
					'--dy': `${critter.dy}px`,
					'--f': critter.flip ? -1 : 1,
					'--life': `${FARM_CRITTERS.lifetimeMs}ms`,
				} as React.CSSProperties
			}>
			<div className='mc-move'>
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
			</div>
		</div>
	);
};
