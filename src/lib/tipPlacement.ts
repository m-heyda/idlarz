// Where a hover card goes: flush against the edge of the item box it belongs to, not under the cursor. Pure, so the
// flipping and clamping rules are unit-tested.

export interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface TipPlacement {
	left: number;
	top: number;
	/** Which side of the item box the card sits on */
	side: 'right' | 'left';
}

/**
 * Puts a card of `tip` size beside the `anchor` box: to its right, or to its left when the right side has no room and
 * the left one does (the side with more room when neither fits). It lines up with the top of the box and slides up or
 * down just enough to stay inside the viewport.
 */
export const placeTip = (anchor: Box, tip: Size, viewport: Size, gap = 8, margin = 8): TipPlacement => {
	const roomRight = viewport.width - margin - (anchor.right + gap);
	const roomLeft = anchor.left - gap - margin;
	const side: TipPlacement['side'] = tip.width <= roomRight || roomRight >= roomLeft ? 'right' : 'left';
	const left = side === 'right' ? anchor.right + gap : anchor.left - gap - tip.width;
	const maxTop = viewport.height - margin - tip.height;
	const top = Math.max(margin, Math.min(anchor.top, maxTop));
	return { left: Math.max(margin, left), top, side };
};
