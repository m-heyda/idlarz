'use client';

import React, { useState } from 'react';
import type { PlayerClassId } from '@/config/playerClasses';
import { login, register, saveProfile, type AuthResult, type Profile } from '@/lib/authClient';
import HeroCreator from './HeroCreator';
import { creatorAvatar } from '@/catalog/avatars';

export type AuthMode = 'login' | 'register' | 'profile';

export interface AuthFormProps {
	/** Which form opens first. 'profile': signed in, but the profile row is missing (a half-finished sign-up). */
	initialMode: AuthMode;
	onSignedIn: (profile: Profile | null) => void;
	onUnavailable: () => void;
	/** Told when the form switches between log in and register, so the frame can retitle itself. */
	onModeChange?: (mode: AuthMode) => void;
}

/** The window title that goes with each form. */
export const authTitle = (mode: AuthMode): string => (mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your hero' : 'Finish your hero');

/** Log in, register (character name, one of the four heroes and one of its two avatars; the server reserves the name and checks the avatar) or finish a profile (the same hero block). No frame of its own: the start page and the landing window both wrap it. */
const AuthForm: React.FC<AuthFormProps> = ({ initialMode, onSignedIn, onUnavailable, onModeChange }) => {
	const [mode, setModeState] = useState<AuthMode>(initialMode);
	const setMode = (next: AuthMode) => {
		setModeState(next);
		onModeChange?.(next);
	};
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [playerClass, setPlayerClass] = useState<PlayerClassId | null>(null);
	const [avatarPick, setAvatarPick] = useState<string | null>(null);
	// until the player chooses one of the class's two avatars, the avatar is the class's default
	const avatarId = creatorAvatar(playerClass, avatarPick);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const needsHero = mode !== 'login';
	const needsAccount = mode !== 'profile';
	const ready =
		(!needsAccount || (email.trim() !== '' && password !== '')) &&
		(!needsHero || (name.trim() !== '' && playerClass !== null)) &&
		(!needsHero || avatarId !== null);

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
			else if (mode === 'register') settle(await register(email, password, name, playerClass as PlayerClassId, avatarId));
			else settle(await saveProfile(name, playerClass as PlayerClassId, avatarId));
		} finally {
			setBusy(false);
		}
	};

	return (
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
				<HeroCreator
					name={name}
					onName={setName}
					playerClass={playerClass}
					onClass={(id) => {
						setPlayerClass(id);
						setAvatarPick(null);
					}}
					avatarId={avatarId}
					onAvatar={setAvatarPick}
					disabled={busy}
				/>
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
					}}
				>
					{mode === 'login' ? 'New here? Register' : 'Already have an account? Log in'}
				</button>
			)}
		</form>
	);
};

export default AuthForm;
