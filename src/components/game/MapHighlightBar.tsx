import React, { useEffect, useState } from 'react';
import { HoverTip, IconButton } from '../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../packages/design-system/src/components/tooltips';
import { useUiStore } from '@/stores/uiStore';
import type { UiPrefKey } from '@/lib/uiPrefs';

// The three buttons under the map (IDL-376): Chests, Ores and Monsters. Each turns on the soft markers of `MapMarkers` for that kind; the choice is remembered in this browser (a view option, not game state).
// They sit just above the dock, in the middle of the screen, and are outside the map's click area (a press on them pays no click gold).

const BUTTONS: { pref: Extract<UiPrefKey, 'markChests' | 'markOres' | 'markMonsters'>; label: string; icon: string; tip: string }[] = [
	{
		pref: 'markChests',
		label: 'Chests',
		icon: '/pixel/icons/bonus_chest.png',
		tip: 'Mark the treasure chests on the map, and point to the nearest one that is out of view.',
	},
	{
		pref: 'markOres',
		label: 'Ores',
		icon: '/pixel/rocks/rock_silver.png',
		tip: 'Mark the rocks and ores you can mine, and point to the nearest one that is out of view.',
	},
	{
		pref: 'markMonsters',
		label: 'Monsters',
		icon: '/pixel/ui/menu_bestiary.png',
		tip: 'Mark the monsters on the map, and point to the nearest one that is out of view.',
	},
];

const MapHighlightBar: React.FC = () => {
	const markChests = useUiStore((state) => state.markChests);
	const markOres = useUiStore((state) => state.markOres);
	const markMonsters = useUiStore((state) => state.markMonsters);
	const marks = { markChests, markOres, markMonsters };
	const setPref = useUiStore((state) => state.setPref);
	const [bottom, setBottom] = useState(96);

	// sit just above the dock, whatever its height
	useEffect(() => {
		const dock = document.querySelector<HTMLElement>('[data-hud-dock]');
		if (!dock) return;
		const place = () => setBottom(dock.offsetHeight + 14);
		place();
		const observer = new ResizeObserver(place);
		observer.observe(dock);
		return () => observer.disconnect();
	}, []);

	return (
		<div data-map-highlight-bar style={{ position: 'fixed', left: '50%', bottom, transform: 'translateX(-50%)', zIndex: 38 }}>
			<div className='ds-root' style={{ display: 'flex', gap: 6 }}>
				{BUTTONS.map(({ pref, label, icon, tip }) => (
					<HoverTip key={pref} placement='above' align='center' tip={<HintTooltip title={`Show ${label.toLowerCase()}`} text={tip} />}>
						<IconButton small icon={icon} label={label} active={marks[pref]} aria-pressed={marks[pref]} onClick={() => setPref(pref, !marks[pref])} />
					</HoverTip>
				))}
			</div>
		</div>
	);
};

export default MapHighlightBar;
