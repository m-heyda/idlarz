// Tiny event bus for the "+N resource" popups that appear at the cursor.

export interface FloatItem {
	resource: string;
	amount: number;
}

export interface FloatDetail {
	x: number;
	y: number;
	items: FloatItem[];
}

export const FLOAT_EVENT = 'idlarz:float';

export const emitFloat = (detail: FloatDetail) => {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<FloatDetail>(FLOAT_EVENT, { detail }));
};

// A tile's onClick runs before the window-level click listener, so it parks its tap result here
// and the global click handler merges it into the single popup for that click.
let pendingTap: { items: FloatItem[] } | null = null;

export const queueTileTap = (items: FloatItem[]) => {
	pendingTap = { items };
};

export const takeTileTap = () => {
	const tap = pendingTap;
	pendingTap = null;
	return tap;
};

/** Sum amounts per resource, keeping first-seen order. */
export const mergeItems = (...lists: FloatItem[][]): FloatItem[] => {
	const order: string[] = [];
	const totals: Record<string, number> = {};
	lists.flat().forEach(({ resource, amount }) => {
		if (!(resource in totals)) {
			order.push(resource);
			totals[resource] = 0;
		}
		totals[resource] += amount;
	});
	return order.map((resource) => ({ resource, amount: totals[resource] }));
};
