'use client';

import React, { useEffect, useRef, useState } from 'react';
import PixelModal from '@/components/game/PixelModal';
import type { UnavailableReason } from '@/lib/authClient';

const NOOP = () => {};

/** An outage may pass on its own: look again this often while the dialog is open. */
const AUTO_RETRY_MS = 15000;

/**
 * Accounts cannot be reached (outage, missing setup, no network). The game is played with an account only (the server runs spawns,
 * chests and fights), so there is nothing to do but wait: the browser's own save is untouched. `onRetry` looks again without leaving
 * this dialog (it resolves when the answer is in); if accounts are back the page moves on. With no server setup retrying cannot help.
 */
const AuthUnavailable: React.FC<{ reason: UnavailableReason; onRetry: () => Promise<void> }> = ({ reason, onRetry }) => {
	const [busy, setBusy] = useState(false);
	const [tries, setTries] = useState(0);
	const alive = useRef(true);
	const busyRef = useRef(false);
	const notConfigured = reason === 'not_configured';

	const retry = async () => {
		if (busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		await onRetry();
		busyRef.current = false;
		if (alive.current) {
			setBusy(false);
			setTries((n) => n + 1);
		}
	};

	useEffect(() => {
		alive.current = true;
		if (notConfigured) return () => void (alive.current = false);
		const timer = setInterval(() => void retry(), AUTO_RETRY_MS);
		return () => {
			alive.current = false;
			clearInterval(timer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [notConfigured]);

	return (
		<div className='fixed inset-0 bg-[#14100c]'>
			<PixelModal title='Accounts unavailable' size='sm' hideClose closeOnBackdrop={false} onClose={NOOP}>
				<p className='text-sm text-center text-[#a89878] mb-2'>
					{notConfigured
						? 'Accounts are not set up on this server (the Supabase settings are missing), so there is nothing to retry.'
						: 'Login is not reachable right now.'}{' '}
					The game runs on its server, so it waits for it. Your progress is safe in this browser and in your account.
				</p>
				{!notConfigured && (
					<p className='text-xs text-center text-[#7a6a52] mb-4' aria-live='polite'>
						{busy ? 'Checking...' : tries > 0 ? 'Still unreachable. Checking again every few seconds.' : 'Checking again every few seconds.'}
					</p>
				)}
				<div className='flex justify-center gap-2'>
					{!notConfigured && (
						<button className='px-btn px-btn-blue' onClick={() => void retry()} disabled={busy} autoFocus>
							{busy ? 'Checking...' : 'Retry'}
						</button>
					)}
				</div>
			</PixelModal>
		</div>
	);
};

export default AuthUnavailable;
