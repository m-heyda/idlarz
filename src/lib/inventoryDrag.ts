// What is being dragged between the bag and the equipment slots (HTML5 drag and drop cannot read data during dragover).

export type DragPayload = { kind: 'bag'; index: number } | { kind: 'equip'; slot: string };

let current: DragPayload | null = null;

export const setDrag = (payload: DragPayload) => {
	current = payload;
};
export const getDrag = () => current;
export const clearDrag = () => {
	current = null;
};
