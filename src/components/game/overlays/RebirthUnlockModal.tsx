import React from 'react';
import { biomeArtUrl } from '@/config/biomeArt';
import { biomeColor } from '@/config/biomePalette';
import { formatNumber } from '@/utils/formatters';
import type { RebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import PixelModal from '../PixelModal';
import ResourceIcon from '../ResourceIcon';

/** The small "what you unlocked" modal shown right after a rebirth: the new biome, what its tiles make, and that monsters and buildings follow later. */
const RebirthUnlockModal: React.FC<{ intro: RebirthUnlockIntro; onClose: () => void }> = ({ intro, onClose }) => (
	<PixelModal title='New land unlocked' size='sm' onClose={onClose}>
		<div className='px-card mb-3 text-sm text-center'>
			<div className='text-xs uppercase tracking-widest text-[#a89878] mb-2'>Rebirth {intro.rebirths}</div>
			{biomeArtUrl(intro.biome) && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={biomeArtUrl(intro.biome)}
					alt={intro.label}
					width={160}
					height={160}
					className='pixelated mx-auto mb-2'
					style={{ imageRendering: 'pixelated' }}
				/>
			)}
			<div className='flex items-center justify-center gap-3 px-3 py-2 mx-auto w-fit border-2 border-[#8a6a3a] bg-[#1a140c]' data-testid='rebirth-biome-header'>
				<span
					aria-hidden='true'
					className='inline-block h-8 w-8 border-2 border-black/70 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.18)]'
					style={{ background: biomeColor(intro.biome) }}
				/>
				<span className='text-lg font-bold uppercase tracking-wider text-[#f0d27a]'>{intro.label}</span>
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
