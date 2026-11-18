import { create } from 'zustand';
import type { RockTier } from '@/config/rocks';
import type { PublicRock } from '@/lib/offline/types';

// The browser's picture of the rocks on the map. The SERVER owns them (which rock stands where, its tier and how many clicks it has taken, see `src/lib/offline/online.ts` hitRock): this store only holds the last list, plus the clicks the player has made that the server has not
// answered yet (shown at once so a click feels instant), and the break effects being played. It is kept apart from the game store on purpose: a click on a rock must not re-render the map, and rocks are not saved by the browser.

export interface RockView {
	n: number;
	x: number;
	y: number;
	tier: RockTier;
	/** Clicks counted so far: the server's number plus the clicks still on their way */
	hits: number;
	need: number;
	/** Clicks the server has not acknowledged yet */
	pending: number;
	/** Goes up with every click: restarts the chop animation */
	chop: number;
	/** The last click reached the clicks it needs: the break is being confirmed by the server */
	breaking: boolean;
}

/** A rock that just broke: where it stood and what came out of it (drives the particles and the dropped pieces). */
export interface RockBurst {
	id: number;
	x: number;
	y: number;
	tier: RockTier;
	stone: number;
	coal: number;
	/** Crafting bag key -> amount of the ingredients found */
	stash: Record<string, number>;
}

interface RockStore {
	rocks: Record<string, RockView>;
	bursts: RockBurst[];
	/** Takes the server's list of rocks. A rock the server no longer lists is gone; for one the player is still clicking the larger count wins until the server has caught up. */
	setFromServer: (rocks: readonly PublicRock[]) => void;
	/** One click, counted at once. Returns the rock, or null when there is none (or it is already being confirmed). */
	localHit: (x: number, y: number) => RockView | null;
	/** The server answered a batch of `sent` clicks: its total is `hits` out of `need` (the server's number, so a browser that loaded an older rule list still shows the right count); the clicks still pending are added on top. */
	ack: (x: number, y: number, sent: number, hits: number, broken: boolean, need?: number) => void;
	/** A batch was lost: its clicks are not counted */
	lose: (x: number, y: number, sent: number) => void;
	remove: (x: number, y: number) => void;
	pushBurst: (burst: Omit<RockBurst, 'id'>) => void;
	dropBurst: (id: number) => void;
	reset: () => void;
}

export const rockKey = (x: number, y: number): string => `${x},${y}`;

let burstId = 0;

export const useRockStore = create<RockStore>((set, get) => ({
	rocks: {},
	bursts: [],
	setFromServer: (list) => {
		const old = get().rocks;
		const next: Record<string, RockView> = {};
		for (const r of list) {
			const key = rockKey(r.x, r.y);
			const before = old[key];
			const mine = before && before.n === r.n ? before : undefined;
			const pending = mine?.pending ?? 0;
			next[key] = {
				n: r.n,
				x: r.x,
				y: r.y,
				tier: r.tier,
				need: r.need,
				hits: Math.min(r.need, pending > 0 ? Math.max(r.hits, mine!.hits) : r.hits),
				pending,
				chop: mine?.chop ?? 0,
				breaking: mine?.breaking ?? false,
			};
		}
		set({ rocks: next });
	},
	localHit: (x, y) => {
		const rock = get().rocks[rockKey(x, y)];
		if (!rock || rock.breaking) return null;
		const hits = Math.min(rock.need, rock.hits + 1);
		const next: RockView = { ...rock, hits, pending: rock.pending + 1, chop: rock.chop + 1, breaking: hits >= rock.need };
		set({ rocks: { ...get().rocks, [rockKey(x, y)]: next } });
		return next;
	},
	ack: (x, y, sent, hits, broken, need) => {
		const key = rockKey(x, y);
		const rock = get().rocks[key];
		if (!rock) return;
		if (broken) {
			const { [key]: _gone, ...rest } = get().rocks;
			void _gone;
			set({ rocks: rest });
			return;
		}
		const pending = Math.max(0, rock.pending - sent);
		const total = need !== undefined && need > 0 ? need : rock.need;
		set({ rocks: { ...get().rocks, [key]: { ...rock, need: total, pending, hits: Math.min(total, hits + pending), breaking: false } } });
	},
	lose: (x, y, sent) => {
		const key = rockKey(x, y);
		const rock = get().rocks[key];
		if (!rock) return;
		set({ rocks: { ...get().rocks, [key]: { ...rock, pending: Math.max(0, rock.pending - sent), hits: Math.max(0, rock.hits - sent), breaking: false } } });
	},
	remove: (x, y) => {
		const { [rockKey(x, y)]: _gone, ...rest } = get().rocks;
		void _gone;
		set({ rocks: rest });
	},
	pushBurst: (burst) => set({ bursts: [...get().bursts, { ...burst, id: ++burstId }] }),
	dropBurst: (id) => set({ bursts: get().bursts.filter((b) => b.id !== id) }),
	reset: () => set({ rocks: {}, bursts: [] }),
}));
