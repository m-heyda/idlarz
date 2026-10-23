import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { MeadowCritter, MeadowDecor, useMeadowCritters, Critter } from './MeadowLayer';
import { ANIMALS } from '@/config/gameConfig';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import { calculateAnimalCost } from '@/utils/gameUtils';
import { formatNumber } from '@/utils/formatters';
import { Animal, ClickInput } from '@/types/game';
import PixelIcon from '../PixelIcon';
import LevelOrb from '../LevelOrb';
import ResourceIcon from '../ResourceIcon';
import {
	ANCHOR,
	ANIMAL_MOTION,
	PEN,
	project,
	randomSpot,
	seeded,
	walkable,
} from './farmGeometry';

interface Agent {
	key: string;
	id: string;
	first: boolean;
	ghost: boolean;
	x: number;
	y: number;
	tx: number;
	ty: number;
	wait: number;
	flip: boolean;
	moving: boolean;
}

interface Instance {
	key: string;
	animal: Animal;
	level: number;
	first: boolean;
	ghost: boolean;
}

// Where animals you do not own yet stand (as dark silhouettes with a price tag)
const GHOST_SPOTS: Record<string, { x: number; y: number }> = {
	chicken: { x: -3.2, y: -2.8 },
	pig: { x: 3.4, y: -2.4 },
	cow: { x: -3.6, y: -0.4 },
	deer: { x: 1.4, y: -0.2 },
};

/** Animals on screen for a level: one per type, more of them as it grows (cosmetic) */
const copiesFor = (level: number) => (level <= 0 ? 1 : Math.min(3, 1 + Math.floor((level - 1) / 4)));

const hash = (s: string) => {
	let h = 7;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
};

interface FarmSceneProps {
	farmLevels: Record<string, number>;
	food: number;
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	/** animal id that was just bought / upgraded (plays a little burst) */
	celebrate: string | null;
	/** a bonus critter was clicked (cursor position for the popup) */
	onCatchCritter: (critter: Critter, x: number, y: number, input: ClickInput) => void;
}

/**
 * The farm as a tiny game: an isometric pen (barn, trough, hay, gate) with your animals wandering about.
 * Click an animal to select it (gold outline) and manage it in the side panel; click the grass to deselect.
 */
const FarmScene: React.FC<FarmSceneProps> = ({ farmLevels, food, selectedId, onSelect, celebrate, onCatchCritter }) => {
	const stageRef = useRef<HTMLDivElement>(null);
	const { critters, remove } = useMeadowCritters(stageRef);
	const nodes = useRef(new Map<string, HTMLDivElement>());
	const agents = useRef(new Map<string, Agent>());
	const selectedRef = useRef<string | null>(selectedId);
	selectedRef.current = selectedId;

	const instances = useMemo<Instance[]>(
		() =>
			ANIMALS.flatMap((animal) => {
				const level = farmLevels[animal.id] || 0;
				return Array.from({ length: copiesFor(level) }, (_, i) => ({
					key: `${animal.id}-${i}`,
					animal,
					level,
					first: i === 0,
					ghost: level <= 0,
				}));
			}),
		[farmLevels]
	);

	const place = (el: HTMLDivElement, a: Agent) => {
		const p = project(a.x, a.y);
		el.style.transform = `translate(${(p.x - ANCHOR.x) * PEN.zoom}px, ${(p.y - ANCHOR.y) * PEN.zoom}px)`;
		el.style.zIndex = String(Math.round(p.y));
		el.dataset.dir = a.flip ? 'r' : 'l';
		el.dataset.moving = a.moving ? '1' : '0';
	};

	// keep one agent per visible instance; new ones appear at a spot of their own
	useLayoutEffect(() => {
		const wanted = new Set(instances.map((i) => i.key));
		agents.current.forEach((_, k) => {
			if (!wanted.has(k)) agents.current.delete(k);
		});
		instances.forEach((inst) => {
			let a = agents.current.get(inst.key);
			if (!a) {
				const ghostSpot = GHOST_SPOTS[inst.animal.id];
				const rnd = seeded(hash(inst.key));
				const spot = inst.ghost && ghostSpot ? ghostSpot : randomSpot(rnd);
				a = {
					key: inst.key,
					id: inst.animal.id,
					first: inst.first,
					ghost: inst.ghost,
					x: spot.x,
					y: spot.y,
					tx: spot.x,
					ty: spot.y,
					wait: 0.5 + rnd() * 2.5,
					flip: rnd() > 0.5,
					moving: false,
				};
				agents.current.set(inst.key, a);
			}
			a.ghost = inst.ghost;
			const el = nodes.current.get(inst.key);
			if (el) place(el, a);
		});
	}, [instances]);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			agents.current.forEach((a) => {
				const el = nodes.current.get(a.key);
				if (!el) return;
				const frozen = a.ghost || a.id === selectedRef.current;
				if (frozen) {
					a.moving = false;
				} else if (a.wait > 0) {
					a.wait -= dt;
					a.moving = false;
					if (a.wait <= 0) {
						const spot = randomSpot();
						a.tx = spot.x;
						a.ty = spot.y;
					}
				} else {
					const dx = a.tx - a.x;
					const dy = a.ty - a.y;
					const dist = Math.hypot(dx, dy);
					const stepLen = (ANIMAL_MOTION[a.id]?.speed ?? 1) * dt;
					if (dist <= stepLen) {
						a.x = a.tx;
						a.y = a.ty;
						a.moving = false;
						a.wait = 1 + Math.random() * 3.5;
					} else {
						const nx = a.x + (dx / dist) * stepLen;
						const ny = a.y + (dy / dist) * stepLen;
						if (walkable(nx, ny)) {
							a.x = nx;
							a.y = ny;
							a.moving = true;
							// screen-space x of the move decides which way the sprite faces
							a.flip = dx - dy > 0;
						} else {
							a.wait = 0.2;
							a.moving = false;
						}
					}
				}
				place(el, a);
			});
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<div
			ref={stageRef}
			className='farm-stage'
			onClick={(e) => {
				if ((e.target as HTMLElement).closest('.meadow-critter')) return;
				onSelect(null);
			}}>
			<MeadowDecor />
			<div className='farm-cloud' />
			<div className='farm-pen' style={{ width: PEN.w * PEN.zoom, height: PEN.h * PEN.zoom }}>
				<PixelIcon name='farm_back' scale={PEN.zoom} alt='Farm pen' className='farm-layer' />

				{instances.map((inst) => {
					const a = inst.animal;
					const selected = selectedId === a.id;
					const cost = calculateAnimalCost(a, inst.level);
					return (
						<div
							key={inst.key}
							ref={(n) => {
								if (n) nodes.current.set(inst.key, n);
								else nodes.current.delete(inst.key);
							}}
							className='farm-animal'
							data-selected={selected}
							data-owned={!inst.ghost}
							data-celebrate={celebrate === a.id}
							title={a.name}>
							<span className='farm-shadow' />
							<span
								className='farm-sprite'
								onClick={(e) => {
									e.stopPropagation();
									onSelect(selected ? null : a.id);
								}}>
								<PixelIcon name={ANIMAL_PIXEL_ICONS[a.id]} scale={2} alt={a.name} />
							</span>
							{!inst.ghost && inst.first && (
								<span className='farm-lvl'>
									<LevelOrb level={inst.level} />
								</span>
							)}
							{inst.ghost && (
								<span className={`farm-tag${food >= cost ? ' can' : ''}`}>
									{formatNumber(cost)}
									<ResourceIcon resource='food' />
								</span>
							)}
							{celebrate === a.id && inst.first && (
								<span className='farm-burst'>
									<i />
									<i />
									<i />
									<i />
									<i />
									<i />
								</span>
							)}
						</div>
					);
				})}

				<PixelIcon name='farm_front' scale={PEN.zoom} alt='' className='farm-layer farm-front' />
			</div>

			{critters.map((c) => (
				<MeadowCritter key={c.id} critter={c} onCatch={onCatchCritter} onExpire={remove} />
			))}
		</div>
	);
};

export default FarmScene;
