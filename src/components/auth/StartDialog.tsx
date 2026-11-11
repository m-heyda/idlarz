'use client';

import React, { useState } from 'react';
import PixelModal from '@/components/game/PixelModal';
import AuthForm, { authTitle, type AuthMode } from '@/components/auth/AuthForm';
import type { Profile } from '@/lib/authClient';

interface Props {
	/** 'profile': signed in, but the profile row is missing (a half-finished sign-up). */
	startMode: 'guest' | 'profile';
	onSignedIn: (profile: Profile | null) => void;
	onUnavailable: () => void;
}

const NOOP = () => {};

/** Full-screen frame around the auth form (used by the `/play` gate for the "finish your hero" step). The landing page wraps the same `AuthForm` in its own window. */
const StartDialog: React.FC<Props> = ({ startMode, onSignedIn, onUnavailable }) => {
	const initialMode: AuthMode = startMode === 'profile' ? 'profile' : 'login';
	const [mode, setMode] = useState<AuthMode>(initialMode);
	return (
		<div className='fixed inset-0 bg-[#14100c]'>
			<PixelModal title={authTitle(mode)} size={mode === 'login' || mode === 'forgot' ? 'sm' : 'md'} hideClose closeOnBackdrop={false} onClose={NOOP}>
				<AuthForm initialMode={initialMode} onSignedIn={onSignedIn} onUnavailable={onUnavailable} onModeChange={setMode} />
			</PixelModal>
		</div>
	);
};

export default StartDialog;
