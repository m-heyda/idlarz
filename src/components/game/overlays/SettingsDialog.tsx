import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import audioManager from '@/utils/audioManager';
import { Button } from '../../../../packages/design-system/src/components/primitives';
import { Slider } from '../../../../packages/design-system/src/components/composites';
import GameModal from '../GameModal';

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
	<div className='ds-listrow ds-listrow-line'>
		<div style={{ minWidth: 0, flex: 1 }}>
			<div>{label}</div>
			{hint && (
				<div className='ds-dim' style={{ fontSize: 12 }}>
					{hint}
				</div>
			)}
		</div>
		<div style={{ flexShrink: 0 }}>{children}</div>
	</div>
);

const Toggle: React.FC<{ on: boolean; onChange: (on: boolean) => void }> = ({ on, onChange }) => (
	<Button size='sm' tone={on ? 'gold' : 'dark'} aria-pressed={on} onClick={() => onChange(!on)} style={{ minWidth: 56 }}>
		{on ? 'On' : 'Off'}
	</Button>
);

/** Settings: sound, volume, ambient map life and Brother Alder, plus a shortcut to the save tools. Drawn with the design system. */
const SettingsDialog: React.FC = () => {
	const open = useUiStore((state) => state.settingsOpen);
	const close = useUiStore((state) => state.closeSettings);
	const toggleSaveMenu = useUiStore((state) => state.toggleSaveMenu);
	const { soundEnabled, volume, ambientLife, guideEnabled, setSoundEnabled, setVolume, setAmbientLife, setGuideEnabled } = useSettingsStore();

	if (!open) return null;

	return (
		<GameModal title='Settings' width={560} onClose={close}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Row label='Sound effects'>
					<Toggle on={soundEnabled} onChange={setSoundEnabled} />
				</Row>

				<Row label={`Volume ${Math.round(volume * 100)}%`}>
					<div className='ds-slider-bare' style={{ width: 240 }} onMouseUp={() => audioManager.playSound('click')}>
						<Slider
							value={Math.round(volume * 100)}
							max={100}
							disabled={!soundEnabled}
							onChange={(n) => setVolume(n / 100)}
							readout={`${Math.round(volume * 100)}%`}
						/>
					</div>
				</Row>

				<Row label='Life on the map' hint='Critters wander over your land and ripples play on the water'>
					<Toggle on={ambientLife} onChange={setAmbientLife} />
				</Row>

				<Row label='Brother Alder' hint='The guide who explains the game as you play'>
					<Toggle on={guideEnabled} onChange={setGuideEnabled} />
				</Row>

				<Button
					onClick={() => {
						close();
						toggleSaveMenu();
					}}
				>
					Save & backup (export / import)
				</Button>

				<p className='ds-dim' style={{ fontSize: 12, textAlign: 'center', margin: '4px 0 0' }}>
					Progress saves automatically in this browser. Export a copy to keep it safe.
				</p>
			</div>
		</GameModal>
	);
};

export default SettingsDialog;
