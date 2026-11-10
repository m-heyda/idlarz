import React from 'react';
import { biomeColor } from '@/config/biomePalette';
import { formatNumber } from '@/utils/formatters';
import type { RebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import PixelModal from '../PixelModal';
import ResourceIcon from '../ResourceIcon';

/** The small "what you unlocked" modal shown right after a rebirth: the new biome, what its tiles make, and that monsters and buildings follow later. */
const RebirthUnlockModal: React.FC<{ intro: RebirthUnlockIntro; onClose: () => void }> = ({ intro, onClose }) => (
	<PixelModal title='New land unlocked' size='sm' onClose={onClose}>
		<div className='px-card mb-3 text-sm text-center'>
			<div className='text-[#a89878] mb-2'>Rebirth {intro.rebirths}</div>
			<div className='flex items-center justify-center gap-2 text-lg text-[#f0d27a]'>
				<i className='inline-block h-4 w-4 rounded-sm border border-black/50' style={{ background: biomeColor(intro.biome) }} />
				{intro.label}
			</div>
			<p className='text-[#d8c8a0] mt-2 mb-2'>
				Your new map can now grow {intro.label} tiles. Each makes about <b>x{intro.multiplier}</b> the output of {intro.measuredAgainst}:
			</p>
			<div className='flex flex-wrap justify-center gap-x-4 gap-y-1 text-[#ecdcb4]'>
				{intro.outputs.map((o) => (
					<span key={o.resource} className='inline-flex items-center gap-1 whitespace-nowrap'>
						<ResourceIcon resource={o.resource} />+{formatNumber(o.perSecond)}/s
					</span>
				))}
			</div>
			<p className='text-xs text-[#a89878] mt-3'>{intro.note}</p>
		</div>
		<div className='flex justify-center'>
			<button className='px-btn px-btn-gold' onClick={onClose}>
				Continue
			</button>
		</div>
	</PixelModal>
);

export default RebirthUnlockModal;
