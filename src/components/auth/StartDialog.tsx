'use client';

import React, { useState } from 'react';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { login, register, saveProfile, type AuthResult, type Profile } from '@/lib/authClient';
import PixelModal from '@/components/game/PixelModal';
import PixelIcon from '@/components/game/PixelIcon';
import '@/styles/Heroes.css';

type Mode = 'login' | 'register' | 'profile';

interface Props {
	/** 'profile': signed in, but the profile row is missing (a half-finished sign-up). */
	startMode: 'guest' | 'profile';
	onSignedIn: (profile: Profile | null) => void;
	onUnavailable: () => void;
}

const NOOP = () => {};

/** Start page for guests: log in, or register with a character name and one of the four heroes. */
const StartDialog: React.FC<Props> = ({ startMode, onSignedIn, onUnavailable }) => {
	const [mode, setMode] = useState<Mode>(startMode === 'profile' ? 'profile' : 'login');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [playerClass, setPlayerClass] = useState<PlayerClassId | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const needsHero = mode !== 'login';
	const needsAccount = mode !== 'profile';
	const ready =
		(!needsAccount || (email.trim() !== '' && password !== '')) && (!needsHero || (name.trim() !== '' && playerClass !== null));

	const settle = (result: AuthResult) => {
		if (result.status === 'ok') return onSignedIn(result.profile);
		if (result.status === 'unavailable') return onUnavailable();
		setError(result.status === 'error' ? result.message : 'Something went wrong.');
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!ready || busy) return;
		setBusy(true);
		setError(null);
		try {
			if (mode === 'login') settle(await login(email, password));
			else if (mode === 'register') settle(await register(email, password, name, playerClass as PlayerClassId));
			else settle(await saveProfile(name, playerClass as PlayerClassId));
		} finally {
			setBusy(false);
		}
	};

	const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your hero' : 'Finish your hero';

	return (
		<div className='fixed inset-0 bg-[#14100c]'>
			<PixelModal title={title} size={needsHero ? 'md' : 'sm'} hideClose closeOnBackdrop={false} onClose={NOOP}>
				<form onSubmit={submit} className='flex flex-col gap-3'>
					{needsAccount && (
						<>
							<input
								type='email'
								className='px-input'
								placeholder='Email'
								autoComplete='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								autoFocus
							/>
							<input
								type='password'
								className='px-input'
								placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
								autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</>
					)}

					{needsHero && (
						<>
							<input
								type='text'
								className='px-input'
								placeholder={`Character name (${CHARACTER_NAME_MAX} chars max)`}
								maxLength={CHARACTER_NAME_MAX}
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<p className='text-[#a89878] text-sm text-center'>Choose your hero (cosmetic for now).</p>
							<div className='class-grid' role='radiogroup' aria-label='Hero'>
								{PLAYER_CLASS_ORDER.map((id) => {
									const info = PLAYER_CLASSES[id];
									const selected = id === playerClass;
									return (
										<button
											key={id}
											type='button'
											role='radio'
											aria-checked={selected}
											className='class-card'
											data-selected={selected}
											style={{ '--accent': info.accent } as React.CSSProperties}
											onClick={() => setPlayerClass(id)}>
											<span className='class-card-stage'>
												<PixelIcon name={info.full} scale={2} alt={`${info.race} ${info.label}`} />
											</span>
											<span className='class-card-name'>{info.label}</span>
											<span className='class-card-race'>{info.race}</span>
											<span className='class-card-tag'>{selected ? 'Chosen' : 'Choose'}</span>
										</button>
									);
								})}
							</div>
						</>
					)}

					{error && (
						<p role='alert' className='text-sm text-center text-[#e07a6a]'>
							{error}
						</p>
					)}

					<div className='flex justify-center'>
						<button type='submit' className='px-btn' disabled={!ready || busy}>
							{busy ? 'One moment...' : mode === 'login' ? 'Log in' : mode === 'register' ? 'Register and play' : 'Save and play'}
						</button>
					</div>

					{mode !== 'profile' && (
						<button
							type='button'
							className='text-xs text-[#a89878] underline self-center'
							onClick={() => {
								setError(null);
								setMode(mode === 'login' ? 'register' : 'login');
							}}>
							{mode === 'login' ? 'New here? Register' : 'Already have an account? Log in'}
						</button>
					)}
				</form>
			</PixelModal>
		</div>
	);
};

export default StartDialog;
