'use client';

import React from 'react';
import PixelModal from '@/components/game/PixelModal';

const NOOP = () => {};

/** Accounts cannot be reached (outage, missing setup, no network). The local save is untouched, so the game stays reachable. */
const AuthUnavailable: React.FC<{ onRetry: () => void; onPlayOffline: () => void }> = ({ onRetry, onPlayOffline }) => (
	<div className='fixed inset-0 bg-[#14100c]'>
		<PixelModal title='Accounts unavailable' size='sm' hideClose closeOnBackdrop={false} onClose={NOOP}>
			<p className='text-sm text-center text-[#a89878] mb-4'>
				Login is not reachable right now. Your game is saved in this browser and is not affected, so you can keep playing without an account.
			</p>
			<div className='flex justify-center gap-2'>
				<button className='px-btn' onClick={onRetry}>Retry</button>
				<button className='px-btn px-btn-blue' onClick={onPlayOffline}>Play without account</button>
			</div>
		</PixelModal>
	</div>
);

export default AuthUnavailable;
