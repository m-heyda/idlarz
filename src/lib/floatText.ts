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
