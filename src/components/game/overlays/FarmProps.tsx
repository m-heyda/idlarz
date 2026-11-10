import React, { useMemo } from 'react';
import { PEN } from './farmGeometry';
import { apronProps, apronReach, penProps, propPlace } from './farmLayout';

/** CSS px outside the window that still get drawn, so a part is never seen popping in at the edge */
const MARGIN = 80;

/**
 * The farm's loose parts (fence, buildings, water, dirt, trees, flowers) as plain images laid on the ground plane inside the pen frame. The meadow behind is a
 * repeating tile, and the apron outside the fence is generated to the window's reach, so any window size shows an endless pasture with the pen in its middle.
 */
const FarmProps: React.FC<{ zoom: number; stageW: number; stageH: number }> = ({ zoom, stageW, stageH }) => {
	const pen = useMemo(penProps, []);
	// the reach only grows in steps of 10 units, so resizing the window does not rebuild the apron on every pixel
	const reach = Math.ceil(apronReach(stageW, stageH, zoom) / 10) * 10;
	const apron = useMemo(() => apronProps(reach), [reach]);
	const visible = useMemo(() => {
		const frameLeft = (stageW - PEN.w * zoom) / 2;
		const frameTop = (stageH - PEN.h * zoom) / 2;
		return [...apron, ...pen]
			.map((prop) => ({ prop, place: propPlace(prop) }))
			.filter(({ place }) => {
				const left = frameLeft + place.left * zoom;
				const top = frameTop + place.top * zoom;
				return left + place.w * zoom > -MARGIN && left < stageW + MARGIN && top + place.h * zoom > -MARGIN && top < stageH + MARGIN;
			});
	}, [apron, pen, zoom, stageW, stageH]);

	return (
		<>
			{visible.map(({ prop, place }) => (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					key={prop.key}
					src={`/pixel/farm/${prop.part}.png`}
					alt=''
					draggable={false}
					className='farm-prop'
					style={{ left: place.left * zoom, top: place.top * zoom, width: place.w * zoom, height: place.h * zoom, zIndex: place.z }}
				/>
			))}
		</>
	);
};

export default React.memo(FarmProps);
