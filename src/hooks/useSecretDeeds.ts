import { useEffect } from 'react';
import { reportCuriosity } from '@/lib/curiosityClient';
import { dockComplete, dockWindows, isNightOwlHour, KONAMI, konamiStep } from '@/lib/secretTriggers';
import { guideLive } from '@/lib/tutorial/live';
import { useWindowStore } from '@/stores/windowStore';

const NIGHT_CHECK_MS = 60_000;

/** Keys typed into a text field are not the Konami code. */
const isTyping = (target: EventTarget | null): boolean => {
	const el = target as HTMLElement | null;
	return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/**
 * Reports three secret deeds from the game screen: `konami` (the Konami code typed anywhere outside a text field), `night_owl` (the game open at any point between 3:00 and 3:59 local time, checked on load and every minute)
 * and `dock_shuffle` (every dock window opened at some point since the page loaded). Each id is sent once per page load by `reportCuriosity`; the server allowlist is `lib/offline/curiosity.ts`.
 */
export const useSecretDeeds = (): void => {
	useEffect(() => {
		let progress = 0;
		const onKey = (e: KeyboardEvent) => {
			if (e.repeat || isTyping(e.target)) return;
			progress = konamiStep(progress, e.key);
			if (progress === KONAMI.length) {
				progress = 0;
				reportCuriosity('konami');
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	useEffect(() => {
		const check = () => {
			if (isNightOwlHour(new Date())) reportCuriosity('night_owl');
		};
		check();
		const timer = window.setInterval(check, NIGHT_CHECK_MS);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		const opened = new Set<string>();
		const required = dockWindows(guideLive());
		const note = (order: readonly string[]) => {
			for (const id of order) opened.add(id);
			if (dockComplete(opened, required)) reportCuriosity('dock_shuffle');
		};
		note(useWindowStore.getState().order);
		return useWindowStore.subscribe((state, prev) => {
			if (state.order !== prev.order) note(state.order);
		});
	}, []);
};
