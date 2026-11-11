'use client';

import React, { useEffect, useState } from 'react';
import PixelModal from '@/components/game/PixelModal';
import AuthUnavailable from '@/components/auth/AuthUnavailable';
import LoadingView from '@/components/game/overlays/LoadingView';
import { fetchMe, setNewPassword, type UnavailableReason } from '@/lib/authClient';
import { LANDING_PATH, PLAY_PATH } from '@/lib/playRoute';

const NOOP = () => {};

type Phase = { name: 'checking' } | { name: 'form' } | { name: 'expired' } | { name: 'done' } | { name: 'unavailable'; reason: UnavailableReason };

/**
 * `/reset` (IDL-65): where the emailed link ends (through `/auth/callback`, which already turned the one-time code into a session cookie). A signed-in visitor gets the
 * new-password form (`POST /api/auth/password`, same length rules as sign-up) and goes on to `/play`; without a session the link is expired and the way back is the landing.
 */
export default function ResetPage() {
	const [phase, setPhase] = useState<Phase>({ name: 'checking' });
	const [password, setPassword] = useState('');
	const [again, setAgain] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const check = async () => {
		const me = await fetchMe();
		if (me.status === 'guest') return setPhase({ name: 'expired' });
		if (me.status === 'ok') return setPhase({ name: 'form' });
		setPhase({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
	};

	useEffect(() => {
		void check();
	}, []);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (busy) return;
		if (password !== again) return setError('The two passwords are not the same.');
		setBusy(true);
		setError(null);
		const result = await setNewPassword(password);
		setBusy(false);
		if (result.status === 'ok') {
			setPhase({ name: 'done' });
			window.location.replace(PLAY_PATH);
			return;
		}
		if (result.status === 'unavailable') return setPhase({ name: 'unavailable', reason: result.reason });
		// a 401 says the session is gone: the link is expired
		if (result.status === 'error' && result.message === 'This link is expired.') return setPhase({ name: 'expired' });
		setError(result.status === 'error' ? result.message : 'Something went wrong.');
	};

	switch (phase.name) {
		case 'checking':
		case 'done':
			return <LoadingView />;
		case 'unavailable':
			return <AuthUnavailable reason={phase.reason} onRetry={check} />;
		case 'expired':
			return (
				<div className='fixed inset-0 bg-[#14100c]'>
					<PixelModal title='Reset password' size='sm' hideClose closeOnBackdrop={false} onClose={NOOP}>
						<div className='flex flex-col gap-3'>
							<p className='text-sm text-center text-[#a89878]'>This link is expired. Ask for a new one from the login window.</p>
							<div className='flex justify-center'>
								<a href={LANDING_PATH} className='px-btn'>
									Back to the start
								</a>
							</div>
						</div>
					</PixelModal>
				</div>
			);
		case 'form':
			return (
				<div className='fixed inset-0 bg-[#14100c]'>
					<PixelModal title='Choose a new password' size='sm' hideClose closeOnBackdrop={false} onClose={NOOP}>
						<form onSubmit={submit} className='flex flex-col gap-3'>
							<input
								type='password'
								className='px-input'
								placeholder='New password (8+ characters)'
								autoComplete='new-password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoFocus
							/>
							<input
								type='password'
								className='px-input'
								placeholder='Repeat the new password'
								autoComplete='new-password'
								value={again}
								onChange={(e) => setAgain(e.target.value)}
							/>
							{error && (
								<p role='alert' className='text-sm text-center text-[#e07a6a]'>
									{error}
								</p>
							)}
							<div className='flex justify-center'>
								<button type='submit' className='px-btn' disabled={busy || password === '' || again === ''}>
									{busy ? 'One moment...' : 'Save and play'}
								</button>
							</div>
						</form>
					</PixelModal>
				</div>
			);
	}
}
