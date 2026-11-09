'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import LoadingView from '@/components/game/overlays/LoadingView';
import StartDialog from '@/components/auth/StartDialog';
import SaveHub, { type HubChoice } from '@/components/auth/SaveHub';
import AuthUnavailable from '@/components/auth/AuthUnavailable';
import { fetchMe, logout, readEntered, writeEntered, type Profile, type UnavailableReason } from '@/lib/authClient';
import { fetchCloud, readLink, writeAttempts, writeLink } from '@/lib/cloudClient';
import { canResumeTab, planStart, type CloudInfo } from '@/lib/startPlan';
import { archiveForNewGame, installSave, peekSave, resetSave, type SavePeek } from '@/lib/saveStorage';

// The game (and its save hydration) is only loaded once the gate lets the player in: the game is played with an account only.
const GameApp = dynamic(() => import('./GameApp'), { ssr: false, loading: () => <LoadingView /> });

interface Player {
	userId: string;
	profile: Profile;
}

type HubPhase = { name: 'hub'; player: Player; mode: 'local' | 'cloud' | 'choose'; local: SavePeek; cloud: CloudInfo | null };

type Phase =
	| { name: 'checking' }
	| { name: 'guest' }
	| { name: 'profile' } // signed in but the profile row is missing
	| { name: 'unavailable'; reason: UnavailableReason }
	| HubPhase
	| { name: 'game'; player: Player };

/** The gate in front of the game: login / register, then Continue / choose / New Game when a save exists here or in the account. */
export default function Home() {
	const [phase, setPhase] = useState<Phase>({ name: 'checking' });

	const enterGame = useCallback((player: Player) => {
		writeEntered('account');
		setPhase({ name: 'game', player });
	}, []);

	/** A signed-in player with a profile: look at this browser and at the account, then straight in or the hub. */
	const admit = useCallback(
		async (player: Player) => {
			setPhase({ name: 'checking' });
			const local = peekSave();
			const fetched = await fetchCloud();
			const cloud = fetched.status === 'ok' ? fetched.cloud : fetched.status === 'empty' ? null : 'unavailable';
			// a game saved in this browser before the last season reset is the old season's: it is put aside and a new game starts (a reset is final)
			const lastReset = fetched.status === 'unavailable' ? null : (fetched.lastReset ?? null);
			if (lastReset !== null && local.kind === 'ok' && local.savedAt !== null && local.savedAt < lastReset && archiveForNewGame()) {
				await resetSave();
				writeLink(null);
				window.location.reload(); // resetSave froze this page's save writer: a reload starts the new game writing normally
				return;
			}
			const plan = planStart(local, cloud, readLink(), player.userId);
			if (plan.kind === 'enter') {
				// no save anywhere: a new game that starts the account's cloud save (nothing to sync while the cloud is unreachable)
				if (cloud !== 'unavailable') writeLink({ userId: player.userId, rev: 0 });
				return enterGame(player);
			}
			setPhase({ name: 'hub', player, mode: plan.mode, local, cloud: cloud === 'unavailable' ? null : cloud });
		},
		[enterGame],
	);

	/** Who is signed in. `quiet` keeps the current screen while it looks (the "accounts unavailable" dialog retrying). */
	const check = useCallback(
		async (quiet = false) => {
			if (!quiet) setPhase({ name: 'checking' });
			const result = await fetchMe();
			if (result.status === 'guest') return setPhase({ name: 'guest' });
			if (result.status !== 'ok') return setPhase({ name: 'unavailable', reason: result.status === 'unavailable' ? result.reason : 'outage' });
			if (!result.profile) return setPhase({ name: 'profile' });
			const player = { userId: result.userId, profile: result.profile };
			if (readEntered() === 'account' && canResumeTab(readLink(), player.userId)) return enterGame(player); // same tab, refreshed while playing
			await admit(player);
		},
		[admit, enterGame],
	);

	useEffect(() => {
		void check();
	}, [check]);

	const signedIn = async (profile: Profile | null) => {
		if (!profile) return setPhase({ name: 'profile' });
		const me = await fetchMe();
		if (me.status !== 'ok') return setPhase({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
		await admit({ userId: me.userId, profile });
	};

	/** Carries out the hub's choice. Returns an error text when nothing could be changed. */
	const choose = (hub: HubPhase, choice: HubChoice): string | null => {
		const { player, cloud } = hub;
		if (choice === 'cloud') {
			if (!cloud) return 'Your account save could not be loaded.';
			if (!installSave(cloud.text)) return 'The browser would not store your account save (or keep a copy of the game here). Nothing was changed.';
		} else if (choice === 'fresh') {
			archiveForNewGame(); // keep whatever unreadable text is here before a new game starts writing
		}
		// Local keeps this browser's game: the next upload replaces the account's (its old save stays in the history)
		writeLink({ userId: player.userId, rev: cloud?.rev ?? 0 });
		enterGame(player);
		return null;
	};

	switch (phase.name) {
		case 'checking':
			return <LoadingView />;
		case 'guest':
			return <StartDialog startMode='guest' onSignedIn={signedIn} onUnavailable={() => setPhase({ name: 'unavailable', reason: 'outage' })} />;
		case 'profile':
			return <StartDialog startMode='profile' onSignedIn={signedIn} onUnavailable={() => setPhase({ name: 'unavailable', reason: 'outage' })} />;
		case 'unavailable':
			return <AuthUnavailable reason={phase.reason} onRetry={() => check(true)} />;
		case 'hub':
			return (
				<SaveHub
					mode={phase.mode}
					local={phase.local}
					cloud={phase.cloud}
					onEnter={(choice) => choose(phase, choice)}
					onNewGame={() => {
						// New Game replaced the account's game on the server (SaveHub): the account has no save now, the first upload creates one
						writeLink({ userId: phase.player.userId, rev: 0 });
						writeAttempts([]);
						// resetSave froze this page's save writer: a reload brings the game back up writing normally
						writeEntered('account');
						window.location.reload();
					}}
					onLogout={() => {
						writeEntered(null);
						void logout().then(() => setPhase({ name: 'guest' }));
					}}
				/>
			);
		case 'game':
			return <GameApp profile={phase.player.profile} userId={phase.player.userId} />;
	}
}
