import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import audioManager from '@/utils/audioManager';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
	<div className='px-card flex items-center justify-between gap-4 mb-3'>
		<div>
			<div className='text-[#ecdcb4]'>{label}</div>
			{hint && <div className='text-xs text-[#a89878]'>{hint}</div>}
		</div>
		<div className='shrink-0'>{children}</div>
	</div>
);

/** Visible settings: sound, volume, ambient map life, plus shortcuts to the save tools and the guide. */
const SettingsDialog: React.FC = () => {
	const open = useUiStore((state) => state.settingsOpen);
	const close = useUiStore((state) => state.closeSettings);
	const toggleSaveMenu = useUiStore((state) => state.toggleSaveMenu);
	const openTutorial = useUiStore((state) => state.openTutorial);
	const { soundEnabled, volume, ambientLife, setSoundEnabled, setVolume, setAmbientLife } = useSettingsStore();

	if (!open) return null;

	return (
		<PixelModal title='Settings' size='sm' icon={<PixelIcon name='menu_settings' alt='' />} onClose={close}>
			<Row label='Sound effects'>
				<button
					className={`px-btn px-btn-sm ${soundEnabled ? '' : 'px-btn-gray'}`}
					onClick={() => setSoundEnabled(!soundEnabled)}
					aria-pressed={soundEnabled}>
					{soundEnabled ? 'On' : 'Off'}
				</button>
			</Row>

			<Row label='Volume' hint={`${Math.round(volume * 100)}%`}>
				<input
					type='range'
					min={0}
					max={100}
					value={Math.round(volume * 100)}
					disabled={!soundEnabled}
					onChange={(e) => setVolume(Number(e.target.value) / 100)}
					onMouseUp={() => audioManager.playSound('click')}
					aria-label='Volume'
					className='px-range w-32 disabled:opacity-50'
				/>
			</Row>

			<Row label='Life on the map' hint='Critters wander over your land and ripples play on the water'>
				<button
					className={`px-btn px-btn-sm ${ambientLife ? '' : 'px-btn-gray'}`}
					onClick={() => setAmbientLife(!ambientLife)}
					aria-pressed={ambientLife}>
					{ambientLife ? 'On' : 'Off'}
				</button>
			</Row>

			<div className='flex flex-col gap-3 mt-4'>
				<button
					className='px-btn'
					onClick={() => {
						close();
						toggleSaveMenu();
					}}>
					Save & backup (export / import)
				</button>
				<button
					className='px-btn'
					onClick={() => {
						close();
						openTutorial();
					}}>
					Show guide
				</button>
			</div>

			<p className='text-xs text-[#7a6a52] mt-4 text-center'>Progress saves automatically in this browser. Export a copy to keep it safe.</p>
		</PixelModal>
	);
};

export default SettingsDialog;
