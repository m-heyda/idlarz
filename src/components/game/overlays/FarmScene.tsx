import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MeadowCritter, MeadowDecor, useMeadowCritters, Critter } from './MeadowLayer';
import { ANIMALS, FARM } from '@/config/gameConfig';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import { calculateAnimalCost } from '@/utils/gameUtils';
import { formatNumber } from '@/utils/formatters';
import { Animal, ClickInput } from '@/types/game';
import PixelIcon from '../PixelIcon';
import LevelOrb from '../LevelOrb';
import ResourceIcon from '../ResourceIcon';
import FarmAnimalCard from './FarmAnimalCard';
import {
	ANCHOR,
	ANIMAL_MOTION,
	PEN,
	penZoom,
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

/** Animals drawn for a count: one per animal owned, up to FARM.unitsDrawn (the count badge carries on) */
const copiesFor = (count: number) => (count <= 0 ? 1 : Math.min(FARM.unitsDrawn, count));

const hash = (s: string) => {
	let h = 7;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
};

interface FarmSceneProps {
	farmLevels: Record<string, number>;
	farmUpgrades: Record<string, number>;
	food: number;
	selectedId: string | null;
	onSelect: (id: string | null) => void;
	/** buy animals of a kind: a number, or 'max' for all you can afford */
	onBuy: (animalId: string, count: number | 'max') => void;
	/** animal id that was just bought (plays a little burst) */
	celebrate: string | null;
	/** a bonus critter was clicked (cursor position for the popup) */
	onCatchCritter: (critter: Critter, x: number, y: number, input: ClickInput) => void;
}

/**
 * The farm as a tiny game: an isometric pen (barn, trough, hay, gate) with your animals wandering about, filling the
 * whole window. Hover an animal (or click it to pin) to get its buy card right above it; click the grass to let go.
 */
const FarmScene: React.FC<FarmSceneProps> = ({
	farmLevels,
	farmUpgrades,
	food,
	selectedId,
	onSelect,
	onBuy,
	celebrate,
	onCatchCritter,
}) => {
	const stageRef = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState(3);
	const zoomRef = useRef(zoom);
	zoomRef.current = zoom;
	const { critters, remove } = useMeadowCritters(stageRef, zoomRef);
	const nodes = useRef(new Map<string, HTMLDivElement>());
	const agents = useRef(new Map<string, Agent>());
	const [hoverId, setHoverId] = useState<string | null>(null);
	const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const activeId = hoverId ?? selectedId;
	const activeRef = useRef<string | null>(activeId);
	activeRef.current = activeId;

	// the pen is drawn at the biggest whole-pixel zoom that fits the window
	useLayoutEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const fit = () => setZoom(penZoom(el.clientWidth, el.clientHeight));
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const hover = (id: string | null) => {
		clearTimeout(leaveTimer.current);
		if (id) setHoverId(id);
		else leaveTimer.current = setTimeout(() => setHoverId(null), 220); // time to reach the card
	};
	useEffect(() => () => clearTimeout(leaveTimer.current), []);

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
		const z = zoomRef.current;
		el.style.transform = `translate(${(p.x - ANCHOR.x) * z}px, ${(p.y - ANCHOR.y) * z}px)`;
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
			if (a.ghost && !inst.ghost) {
				// the first animal of a kind was just bought: it steps off its silhouette spot
				a.wait = 0.4;
			}
			a.ghost = inst.ghost;
			const el = nodes.current.get(inst.key);
			if (el) place(el, a);
		});
	}, [instances]);

	// a new zoom moves every animal to its new pixel position at once
	useLayoutEffect(() => {
		agents.current.forEach((a) => {
			const el = nodes.current.get(a.key);
			if (el) place(el, a);
		});
	}, [zoom]);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			agents.current.forEach((a) => {
				const el = nodes.current.get(a.key);
				if (!el) return;
				const frozen = a.ghost || a.id === activeRef.current;
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

	// The card hangs above the first animal of the active kind. Animals of that kind are frozen while it is shown,
	// so reading the agent here (at render time) is stable.
	const activeAnimal = ANIMALS.find((a) => a.id === activeId) ?? null;
	const anchor = activeAnimal ? agents.current.get(`${activeAnimal.id}-0`) : undefined;
	const cardPos = anchor ? project(anchor.x, anchor.y) : null;

	return (
		<div
			ref={stageRef}
			className='farm-stage'
			onClick={(e) => {
				if ((e.target as HTMLElement).closest('.meadow-critter, .farm-card, .farm-hud, .farm-dock')) return;
				onSelect(null);
			}}>
			<MeadowDecor />
			<div className='farm-cloud' />
			<div
				className='farm-pen'
				style={{ width: PEN.w * zoom, height: PEN.h * zoom, '--z': zoom } as React.CSSProperties}>
				<PixelIcon name='farm_back' scale={zoom} alt='Farm pen' className='farm-layer' />

				{instances.map((inst) => {
					const a = inst.animal;
					const selected = activeId === a.id;
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
							data-celebrate={celebrate === a.id}>
							<span className='farm-shadow' />
							<span
								className='farm-sprite'
								onMouseEnter={() => hover(a.id)}
								onMouseLeave={() => hover(null)}
								onClick={(e) => {
									e.stopPropagation();
									onSelect(selectedId === a.id ? null : a.id);
								}}>
								<PixelIcon name={ANIMAL_PIXEL_ICONS[a.id]} scale={zoom} alt={a.name} />
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

				<PixelIcon name='farm_front' scale={zoom} alt='' className='farm-layer farm-front' />

				{activeAnimal && cardPos && (
					<div
						className='farm-card-anchor'
						style={{ left: cardPos.x * zoom, top: (cardPos.y - ANCHOR.y) * zoom }}
						onMouseEnter={() => hover(activeAnimal.id)}
						onMouseLeave={() => hover(null)}>
						<FarmAnimalCard
							animal={activeAnimal}
							owned={farmLevels[activeAnimal.id] || 0}
							upgrades={farmUpgrades}
							food={food}
							pinned={selectedId === activeAnimal.id}
							onBuy={(count) => onBuy(activeAnimal.id, count)}
						/>
					</div>
				)}
			</div>

			{critters.map((c) => (
				<MeadowCritter key={c.id} critter={c} onCatch={onCatchCritter} onExpire={remove} />
			))}
		</div>
	);
};

export default FarmScene;
