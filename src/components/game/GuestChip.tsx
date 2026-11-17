'use client';

import React from 'react';
import { setSavePaused } from '@/lib/saveStorage';
import { wipeGuestStorage } from '@/lib/guestMode';
import { Button } from '../../../packages/design-system/src/components/primitives';
import '@/styles/Guest.css';

/** Where "Register" goes: the landing with the Create account tab open. */
export const REGISTER_PATH = '/?register=1';

/**
 * The guest game's permanent notice, top left (clear of the map and the minimap), above every window: this game is saved in this browser only (nothing goes to an account, the cloud or the rankings), and one button turns it into a real account.
 * Registering discards the guest game (the new account starts fresh, nothing is imported): the save writer is paused first so the closing page cannot write it back, then every guest key is wiped and the landing opens on Create account.
 */
const GuestChip: React.FC = () => {
	const register = () => {
		setSavePaused(true);
		wipeGuestStorage();
		window.location.assign(REGISTER_PATH);
	};
	return (
		<aside className='guest-chip' role='status' aria-label='Guest game'>
			<div className='guest-chip-text'>
				<strong>Guest game</strong>
				<span>Saved in this browser only. Register to keep a real account (you start fresh).</span>
			</div>
			<Button tone='gold' onClick={register}>
				Register
			</Button>
		</aside>
	);
};

export default GuestChip;
