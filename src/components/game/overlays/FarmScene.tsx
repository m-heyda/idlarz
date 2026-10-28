import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MeadowCritter, useMeadowCritters } from './MeadowLayer';
import { ANIMALS, FARM } from '@/config/gameConfig';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import { Animal } from '@/types/game';
import PixelIcon from '../PixelIcon';
import {
	ANCHOR,
	ANIMAL_MOTION,
	PEN,
	penZoom,
	project,
	randomSpot,
	PERSONAL_SPACE,
	roomySpot,
	seeded,
	walkView,
	walkable,
	type Insets,
	type WalkView,
} from './farmGeometry';

interface Agent {
	key: string;
	id: string;
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
	first: boolean;
}

/** Animals drawn for a count: one per animal owned, up to FARM.unitsDrawn (the animal panel carries the real count) */
const copiesFor = (count: number) => Math.min(FARM.unitsDrawn, Math.max(0, count));

/** Candidate spots tried when an animal picks where to wander next; the one farthest from everybody else wins. */
const SPOT_TRIES = 12;

const hash = (s: string) => {
	let h = 7;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
};

interface FarmSceneProps {
	farmLevels: Record<string, number>;
	/** Animal kind to light up (the card in the animal panel being hovered) */
	highlightId: string | null;
	/** animal id that was just bought (plays a little burst) */
	celebrate: string | null;
	/** Panels laid over the window (CSS px): animals and critters keep clear of them */
	insets: Insets;
}

/**
 * The farm as a tiny game: an isometric pen (barn, trough, hay, gate) with your animals wandering about, on a meadow that
 * fills the whole window. The animals are scenery: buying happens in the panel beside the scene.
 */
const FarmScene: React.FC<FarmSceneProps> = ({ farmLevels, highlightId, celebrate, insets }) => {
	const stageRef = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState(3);
	const zoomRef = useRef(zoom);
	zoomRef.current = zoom;
	const insetsRef = useRef(insets);
	insetsRef.current = insets;
	const { critters, remove } = useMeadowCritters(stageRef, insetsRef);
	const nodes = useRef(new Map<string, HTMLDivElement>());
	const agents = useRef(new Map<string, Agent>());
	const viewRef = useRef<WalkView | null>(null);

	const instances = useMemo<Instance[]>(
		() =>
			ANIMALS.flatMap((animal) =>
				Array.from({ length: copiesFor(farmLevels[animal.id] || 0) }, (_, i) => ({
					key: `${animal.id}-${i}`,
					animal,
					first: i === 0,
				}))
			),
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

	// The pasture is shown at a whole-pixel zoom and centred in the window (cropped, never scaled). Whenever the window or a
	// panel changes, work out which part of it is on screen and move any animal that ended up under a panel or off screen.
	useLayoutEffect(() => {
		const el = stageRef.current;
		if (!el) return;
		const fit = () => {
			const z = penZoom(el.clientWidth);
			zoomRef.current = z;
			setZoom(z);
			const view = walkView(el.clientWidth, el.clientHeight, z, insets);
			viewRef.current = view;
			agents.current.forEach((a) => {
				if (!walkable(a.x, a.y, view)) {
					const spot = randomSpot(undefined, view);
					a.x = a.tx = spot.x;
					a.y = a.ty = spot.y;
					a.moving = false;
				}
				const node = nodes.current.get(a.key);
				if (node) place(node, a);
			});
		};
		fit();
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [insets.right, insets.bottom, insets.hudOpen]);

	// keep one agent per visible instance; new ones appear at a spot of their own
	useLayoutEffect(() => {
		const wanted = new Set(instances.map((i) => i.key));
		agents.current.forEach((_, k) => {
			if (!wanted.has(k)) agents.current.delete(k);
		});
		instances.forEach((inst) => {
			let a = agents.current.get(inst.key);
			if (!a) {
				const rnd = seeded(hash(inst.key));
				const others: { x: number; y: number }[] = [];
				agents.current.forEach((o) => others.push({ x: o.x, y: o.y }));
				const spot = roomySpot(others, 40, rnd, viewRef.current);
				a = {
					key: inst.key,
					id: inst.animal.id,
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
		// the next stop: of a few random spots, the one with the most room around it, so the herd spreads out instead of clumping
		const pickSpot = (self: Agent) => {
			const others: { x: number; y: number }[] = [];
			agents.current.forEach((other) => {
				if (other !== self) others.push({ x: other.tx, y: other.ty });
			});
			return roomySpot(others, SPOT_TRIES, Math.random, viewRef.current);
		};

		let raf = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			agents.current.forEach((a) => {
				const el = nodes.current.get(a.key);
				if (!el) return;
				if (a.wait > 0) {
					a.wait -= dt;
					a.moving = false;
					if (a.wait <= 0) {
						const spot = pickSpot(a);
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
						let crowded = false;
						agents.current.forEach((o) => {
							// no walking into another animal (unless already overlapping, so nobody gets stuck)
							if (!crowded && o !== a && Math.hypot(o.x - nx, o.y - ny) < PERSONAL_SPACE && Math.hypot(o.x - a.x, o.y - a.y) >= PERSONAL_SPACE) crowded = true;
						});
						if (!crowded && walkable(nx, ny, viewRef.current)) {
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
		<div ref={stageRef} className='farm-stage'>
			<div className='farm-cloud' />
			<div
				className='farm-pen'
				style={{ width: PEN.w * zoom, height: PEN.h * zoom, '--z': zoom } as React.CSSProperties}>
				<PixelIcon name='farm_back' scale={zoom} alt='Farm pen' className='farm-layer' />

				{instances.map((inst) => {
					const a = inst.animal;
					return (
						<div
							key={inst.key}
							ref={(n) => {
								if (n) nodes.current.set(inst.key, n);
								else nodes.current.delete(inst.key);
							}}
							className='farm-animal'
							data-selected={highlightId === a.id}
							data-celebrate={celebrate === a.id}>
							<span className='farm-shadow' />
							<span className='farm-sprite'>
								<PixelIcon name={ANIMAL_PIXEL_ICONS[a.id]} scale={zoom} alt={a.name} />
							</span>
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
			</div>

			{critters.map((c) => (
				<MeadowCritter key={c.id} critter={c} onExpire={remove} />
			))}
		</div>
	);
};

export default FarmScene;
