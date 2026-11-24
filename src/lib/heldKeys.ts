// Whether Ctrl is held right now, for actions that read a modifier without an event (a double-click in the bag equips into the OTHER ring slot while Ctrl is down). Pure browser state; false on the server.

let ctrl = false;
let installed = false;

const install = (): void => {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	const sync = (event: KeyboardEvent) => {
		ctrl = event.ctrlKey;
	};
	window.addEventListener('keydown', sync);
	window.addEventListener('keyup', sync);
	window.addEventListener('blur', () => {
		ctrl = false;
	});
};

install();

/** True while a Ctrl key is held down. */
export const ctrlHeld = (): boolean => ctrl;
