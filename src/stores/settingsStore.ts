import { create } from 'zustand';
import audioManager from '@/utils/audioManager';
import { scoped } from '@/lib/storageScope';

// Pure UI preferences. They are NOT game state (no effect on progress), so they live in plain localStorage
// and are never part of the encrypted save.
const STORAGE_KEY = scoped('idlarz-settings');

export interface SettingsState {
	soundEnabled: boolean;
	volume: number; // 0..1
	ambientLife: boolean; // wandering critters and water ripples on the map
	loaded: boolean;
	setSoundEnabled: (value: boolean) => void;
	setVolume: (value: number) => void;
	setAmbientLife: (value: boolean) => void;
	load: () => void;
}

const DEFAULTS = { soundEnabled: true, volume: 0.6, ambientLife: true };

const clampVolume = (value: unknown): number =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULTS.volume;

const save = (state: Pick<SettingsState, 'soundEnabled' | 'volume' | 'ambientLife'>) => {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ soundEnabled: state.soundEnabled, volume: state.volume, ambientLife: state.ambientLife })
		);
	} catch {
		/* storage blocked: the settings simply do not persist */
	}
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
	...DEFAULTS,
	loaded: false,
	setSoundEnabled: (value) => {
		set({ soundEnabled: !!value });
		save(get());
	},
	setVolume: (value) => {
		set({ volume: clampVolume(value) });
		save(get());
	},
	setAmbientLife: (value) => {
		set({ ambientLife: !!value });
		save(get());
	},
	// Called once on the client after mount (never on the server)
	load: () => {
		try {
			const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
			if (raw && typeof raw === 'object') {
				set({
					soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : DEFAULTS.soundEnabled,
					volume: clampVolume(raw.volume),
					ambientLife: typeof raw.ambientLife === 'boolean' ? raw.ambientLife : DEFAULTS.ambientLife,
				});
			}
		} catch {
			/* corrupt or blocked: keep the defaults */
		}
		set({ loaded: true });
	},
}));

// Keep the audio manager in step with the settings
if (typeof window !== 'undefined') {
	const apply = (s: SettingsState) => {
		audioManager.setMuted(!s.soundEnabled);
		audioManager.setMasterVolume(s.volume);
	};
	useSettingsStore.subscribe(apply);
	apply(useSettingsStore.getState());
}
