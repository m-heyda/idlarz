import { create } from 'zustand';
import { PREF_DEFAULTS, readPref, readStringPref, writePref, writeStringPref, type UiPrefKey } from '@/lib/uiPrefs';
import type { Drop, MerchantTab } from '@/types/game';
import type { OfflineReport } from '@/lib/offline/apply';
import { useWindowStore } from '@/stores/windowStore';
import { connectedCluster } from '@/utils/cluster';
import { getTile, type World } from '@/utils/world';
import type { ChestLoot } from '@/lib/chests';

/** The badge, title and nickname colour choice of the account with what the pickers allow (see `BadgeState` in `lib/authClient.ts`); `loaded` once the server has answered. */
export interface UiBadge {
	badgeId: string | null;
	titleId: string | null;
	nameColor: string | null;
	colorsUnlocked: boolean;
	admin: boolean;
	earned: readonly string[];
	loaded: boolean;
}

export interface ContextMenuItem {
	id: string;
	label: string;
	onSelect: () => void;
	/** Red entry for something destructive */
	danger?: boolean;
	/** Greyed out; `hint` says why */
	disabled?: boolean;
	hint?: string;
	/** A label that changes while the menu is open (a countdown): the menu asks again every second and shows it instead of `hint` */
	liveHint?: () => string | undefined;
	/** A toggle: shows a tick box */
	checked?: boolean;
	/** A thin rule above this entry */
	separator?: boolean;
	/** Shown as a hover tooltip (a disabled entry shows its `hint` there when it has none) */
	tooltip?: string;
	/** A submenu: choosing the entry replaces the menu with these entries (and a Back entry) instead of running `onSelect` */
	children?: ContextMenuItem[];
}

interface ContextMenuState {
	/** Screen position (viewport px) the menu opens at */
	x: number;
	y: number;
	title?: string;
	items: ContextMenuItem[];
}

let toastId = 0;
let chestNoticeId = 0;
let achievementNoticeId = 0;
/** How long the reward card of an earned achievement stays up (ms) */
const ACHIEVEMENT_NOTICE_MS = 7000;
const noticeTimers = new Map<number, ReturnType<typeof setTimeout>>();
let flashTimer: ReturnType<typeof setTimeout> | null = null;

/** How much one Sell / Buy click moves in the Merchant window: a preset number of units, or all of it */
type MerchantAmount = number | 'max';
const MERCHANT_PRESETS: readonly MerchantAmount[] = [1_000, 1_000_000, 1_000_000_000, 'max'];
export const MERCHANT_CUSTOM_MAX = 12;
const MERCHANT_TABS: readonly MerchantTab[] = ['resources', 'goods', 'upgrades', 'quests', 'gambling'];

/** Stored values are checked on the way in: anything else (an old or edited entry) falls back to the default */
const readMerchantTab = (): MerchantTab => {
	const saved = readStringPref('merchantTab');
	return MERCHANT_TABS.find((tab) => tab === saved) ?? 'resources';
};
const readMerchantPreset = (): MerchantAmount => {
	const saved = readStringPref('merchantPreset');
	return MERCHANT_PRESETS.find((preset) => String(preset) === saved) ?? 1_000;
};

/** How long a short message stays up (ms) */
const TOAST_MS = 2200;
/** How long a chest reward notice stays up (ms); the fade in ContextMenu.css (.chest-toast) runs the same time */
const CHEST_NOTICE_MS = 3000;
/** Most notices of one kind on screen at once; opening more drops the oldest */
const MAX_NOTICES = 5;

type ChestNoticeLoot = ChestLoot & { gems?: number; junk?: Drop[] };
interface ChestNotice {
	id: number;
	loot: ChestNoticeLoot;
}
interface ToastMessage {
	id: number;
	text: string;
	/** The same message repeated in a row (a rapid sale) is one line with a counter */
	count: number;
}

function schedule(id: number, ms: number, remove: () => void) {
	const old = noticeTimers.get(id);
	if (old) clearTimeout(old);
	noticeTimers.set(
		id,
		setTimeout(() => {
			noticeTimers.delete(id);
			remove();
		}, ms),
	);
}

/** How long a highlighted area stays tinted (ms) */
export const HIGHLIGHT_MS = 3000;

// Transient UI flags (never persisted): dialogs that are opened from several places.
interface UiState {
	classDialogOpen: boolean;
	/** The account's chosen avatar (`catalog/avatars.ts`, from the profile; null = none yet): the header and the character window show it. Not part of the save. */
	avatarId: string | null;
	setAvatarId: (id: string | null) => void;
	/** The badge, title and nickname colour the account shows (`profiles.badge_id`: null = default, 'none' = hidden; `title_id`; `name_color`) and the achievements it holds. Loaded from the server once; not part of the save. */
	badge: UiBadge;
	setBadge: (badge: Omit<UiBadge, 'loaded'>) => void;
	badgeDialogOpen: boolean;
	openBadgeDialog: () => void;
	closeBadgeDialog: () => void;
	avatarDialogOpen: boolean;
	openAvatarDialog: () => void;
	closeAvatarDialog: () => void;
	openClassDialog: () => void;
	closeClassDialog: () => void;
	settingsOpen: boolean;
	toggleSettings: () => void;
	closeSettings: () => void;
	rebirthOpen: boolean;
	toggleRebirth: () => void;
	/** The Gem shop window (the header gem chip opens it) */
	gemShopOpen: boolean;
	toggleGemShop: () => void;
	closeGemShop: () => void;
	closeRebirth: () => void;
	saveMenuOpen: boolean;
	toggleSaveMenu: () => void;
	closeSaveMenu: () => void;
	/** The welcome-back window after an absence (what the server paid); null when there is none to show */
	offlineReport: OfflineReport | null;
	showOfflineReport: (report: OfflineReport) => void;
	closeOfflineReport: () => void;
	/** The one right-click / dropdown menu: opened at a screen position with its entries already worked out */
	contextMenu: ContextMenuState | null;
	openContextMenu: (menu: ContextMenuState) => void;
	closeContextMenu: () => void;
	/** Confirmations: a monster to dismiss (id) and a bag stack to discard (slot index) */
	dismissMonsterId: number | null;
	askDismissMonster: (id: number | null) => void;
	discardIndex: number | null;
	askDiscard: (index: number | null) => void;
	/** The building window (art, lore, output, level, the next level's price and its Upgrade button): the tile of the building it was opened for (null = closed) */
	buildingModal: { x: number; y: number } | null;
	openBuildingModal: (x: number, y: number) => void;
	closeBuildingModal: () => void;
	/** The "Build here" window: the free tile it was opened for (null = closed) */
	buildModal: { x: number; y: number } | null;
	openBuildModal: (x: number, y: number) => void;
	closeBuildModal: () => void;
	/** The connected area of one biome that is tinted for a few seconds ("Highlight" in the tile menu): its tiles as map keys */
	highlight: { biome: string; cells: ReadonlySet<number> } | null;
	/** Tints the area of the same biome around tile (x, y): every tile of that biome that touches it, side by side. */
	flashCluster: (world: World, x: number, y: number) => void;
	/** Short messages, stacked under the header (a new one never replaces one still showing) */
	toasts: ToastMessage[];
	showToast: (text: string) => void;
	dismissToast: (id: number) => void;
	/** Chest rewards, stacked: opening chests quickly queues one notice per chest */
	chestNotices: ChestNotice[];
	pushChestNotice: (loot: ChestNoticeLoot) => void;
	/** The reward card of an earned achievement (badge, Congratulations, fanfare): one per achievement, at most a few on screen */
	achievementNotices: { id: number; achievementId: string }[];
	pushAchievementNotice: (achievementId: string) => void;
	dismissAchievementNotice: (id: number) => void;
	dismissChestNotice: (id: number) => void;
	/** Remembered view options (localStorage, see lib/uiPrefs): the minimap, the compact header and the folded panels */
	showMinimap: boolean;
	/** The combat panel is shrunk to its icon (a win or defeat is still announced) */
	combatMinimized: boolean;
	/** Small amounts next to the header's resource icons (off: icons only) */
	compactHeader: boolean;
	/** The Farm window's panels: animal shop, stats readout, upgrade drawer */
	farmAnimalsOpen: boolean;
	farmHudOpen: boolean;
	farmUpgradesOpen: boolean;
	/** The Merchant window remembers its tab and the amount you set (also across visits): the typed value is not lost when you switch windows */
	merchantTab: MerchantTab;
	setMerchantTab: (tab: MerchantTab) => void;
	merchantPreset: MerchantAmount;
	setMerchantPreset: (preset: MerchantAmount) => void;
	merchantCustom: string;
	setMerchantCustom: (text: string) => void;
	/** The resource row the Merchant's Resources tab has selected (set by a click on a header resource; null: none) */
	merchantSelect: string | null;
	/** Opens the Merchant on `resource`: the window comes to the front on the Resources tab with that row selected (gold opens the Upgrades tab, where gold is spent) */
	openMerchantOn: (resource: string) => void;
	/** Like openMerchantOn, but a second press on the same chip, with the Merchant in front, closes the window */
	toggleMerchantOn: (resource: string) => void;
	clearMerchantSelect: () => void;
	setPref: (key: UiPrefKey, value: boolean) => void;
	loadPrefs: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
	classDialogOpen: false,
	avatarId: null,
	setAvatarId: (id) => set({ avatarId: id }),
	badge: { badgeId: null, titleId: null, nameColor: null, colorsUnlocked: false, admin: false, earned: [], loaded: false },
	setBadge: (badge) => set({ badge: { ...badge, loaded: true } }),
	badgeDialogOpen: false,
	openBadgeDialog: () => set({ badgeDialogOpen: true }),
	closeBadgeDialog: () => set({ badgeDialogOpen: false }),
	avatarDialogOpen: false,
	openAvatarDialog: () => set({ avatarDialogOpen: true }),
	closeAvatarDialog: () => set({ avatarDialogOpen: false }),
	openClassDialog: () => set({ classDialogOpen: true }),
	closeClassDialog: () => set({ classDialogOpen: false }),
	settingsOpen: false,
	toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
	closeSettings: () => set({ settingsOpen: false }),
	gemShopOpen: false,
	toggleGemShop: () => set((state) => ({ gemShopOpen: !state.gemShopOpen })),
	closeGemShop: () => set({ gemShopOpen: false }),
	rebirthOpen: false,
	toggleRebirth: () => set((state) => ({ rebirthOpen: !state.rebirthOpen })),
	closeRebirth: () => set({ rebirthOpen: false }),
	saveMenuOpen: false,
	toggleSaveMenu: () => set((state) => ({ saveMenuOpen: !state.saveMenuOpen })),
	closeSaveMenu: () => set({ saveMenuOpen: false }),
	offlineReport: null,
	showOfflineReport: (report) => set({ offlineReport: report }),
	closeOfflineReport: () => set({ offlineReport: null }),
	contextMenu: null,
	openContextMenu: (menu) => set({ contextMenu: menu }),
	closeContextMenu: () => set((state) => (state.contextMenu ? { contextMenu: null } : state)),
	dismissMonsterId: null,
	askDismissMonster: (id) => set({ dismissMonsterId: id, contextMenu: null }),
	discardIndex: null,
	askDiscard: (index) => set({ discardIndex: index, contextMenu: null }),
	buildingModal: null,
	openBuildingModal: (x, y) => set({ buildingModal: { x, y }, contextMenu: null }),
	closeBuildingModal: () => set({ buildingModal: null }),
	buildModal: null,
	openBuildModal: (x, y) => set({ buildModal: { x, y }, contextMenu: null }),
	closeBuildModal: () => set({ buildModal: null }),
	highlight: null,
	flashCluster: (world, x, y) => {
		if (flashTimer) clearTimeout(flashTimer);
		const tile = getTile(world, x, y);
		const cells = connectedCluster(world, x, y);
		if (!tile || cells.size === 0) {
			set({ highlight: null, contextMenu: null });
			return;
		}
		set({ highlight: { biome: tile.biome, cells }, contextMenu: null });
		flashTimer = setTimeout(() => set({ highlight: null }), HIGHLIGHT_MS);
	},
	toasts: [],
	showToast: (text) => {
		const last = get().toasts[get().toasts.length - 1];
		if (last && last.text === text) {
			// the same message again: one line with a counter, its time restarted
			set((state) => ({ toasts: state.toasts.map((t) => (t.id === last.id ? { ...t, count: t.count + 1 } : t)) }));
			schedule(last.id, TOAST_MS, () => get().dismissToast(last.id));
			return;
		}
		const id = ++toastId;
		const next = [...get().toasts, { id, text, count: 1 }];
		const dropped = next.splice(0, Math.max(0, next.length - MAX_NOTICES));
		dropped.forEach((t) => noticeTimers.delete(t.id));
		set({ toasts: next });
		schedule(id, TOAST_MS, () => get().dismissToast(id));
	},
	dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
	chestNotices: [],
	achievementNotices: [],
	pushAchievementNotice: (achievementId) => {
		const id = ++achievementNoticeId;
		const next = [...get().achievementNotices, { id, achievementId }];
		const dropped = next.splice(0, Math.max(0, next.length - 3));
		dropped.forEach((n) => {
			const timer = noticeTimers.get(-1_000_000 - n.id);
			if (timer) clearTimeout(timer);
			noticeTimers.delete(-1_000_000 - n.id);
		});
		set({ achievementNotices: next });
		// keys below -1,000,000 keep these timers apart from the chest and toast timers in the same map
		schedule(-1_000_000 - id, ACHIEVEMENT_NOTICE_MS, () => get().dismissAchievementNotice(id));
	},
	dismissAchievementNotice: (id) => set((state) => ({ achievementNotices: state.achievementNotices.filter((n) => n.id !== id) })),
	pushChestNotice: (loot) => {
		const id = ++chestNoticeId;
		const next = [...get().chestNotices, { id, loot }];
		const dropped = next.splice(0, Math.max(0, next.length - MAX_NOTICES));
		dropped.forEach((n) => {
			const timer = noticeTimers.get(-n.id);
			if (timer) clearTimeout(timer);
			noticeTimers.delete(-n.id);
		});
		set({ chestNotices: next });
		// negative keys keep chest timers apart from toast timers in the same map
		schedule(-id, CHEST_NOTICE_MS, () => get().dismissChestNotice(id));
	},
	dismissChestNotice: (id) => set((state) => ({ chestNotices: state.chestNotices.filter((n) => n.id !== id) })),
	merchantTab: 'resources',
	setMerchantTab: (tab) => {
		writeStringPref('merchantTab', tab);
		set({ merchantTab: tab });
	},
	merchantPreset: 1_000,
	setMerchantPreset: (preset) => {
		writeStringPref('merchantPreset', String(preset));
		set({ merchantPreset: preset });
	},
	merchantSelect: null,
	openMerchantOn: (resource) => {
		const tab: MerchantTab = resource === 'gold' ? 'upgrades' : 'resources';
		writeStringPref('merchantTab', tab);
		set({ merchantTab: tab, merchantSelect: tab === 'resources' ? resource : null });
		useWindowStore.getState().openWindow('merchant');
	},
	toggleMerchantOn: (resource) => {
		const windows = useWindowStore.getState();
		const tab: MerchantTab = resource === 'gold' ? 'upgrades' : 'resources';
		const sameView = get().merchantTab === tab && (tab === 'upgrades' || get().merchantSelect === resource);
		if (sameView && windows.order[windows.order.length - 1] === 'merchant') windows.closeWindow('merchant');
		else get().openMerchantOn(resource);
	},
	clearMerchantSelect: () => set({ merchantSelect: null }),
	merchantCustom: '',
	setMerchantCustom: (text) => {
		const clean = text.slice(0, MERCHANT_CUSTOM_MAX);
		writeStringPref('merchantCustom', clean);
		set({ merchantCustom: clean });
	},
	...PREF_DEFAULTS,
	setPref: (key, value) => {
		writePref(key, value);
		set({ [key]: value });
	},
	// read after mount (the server render has no localStorage): keeps hydration identical
	loadPrefs: () =>
		set({
			merchantTab: readMerchantTab(),
			merchantPreset: readMerchantPreset(),
			merchantCustom: (readStringPref('merchantCustom') ?? '').slice(0, MERCHANT_CUSTOM_MAX),
			showMinimap: readPref('showMinimap'),
			combatMinimized: readPref('combatMinimized'),
			compactHeader: readPref('compactHeader'),
			farmAnimalsOpen: readPref('farmAnimalsOpen'),
			farmHudOpen: readPref('farmHudOpen'),
			farmUpgradesOpen: readPref('farmUpgradesOpen'),
		}),
}));
