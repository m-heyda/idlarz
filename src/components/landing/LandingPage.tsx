'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthForm, { authTitle, type AuthMode } from '@/components/auth/AuthForm';
import PixelIcon from '@/components/game/PixelIcon';
import { GAME_TITLE } from '@/config/branding';
import { LANDING_BIOMES, LANDING_FEATURES, type LandingFeature } from '@/config/landing';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { fetchMe, logout, type Profile, type ProfileStats, type UnavailableReason } from '@/lib/authClient';
import { PLAY_PATH, safeNextPath } from '@/lib/playRoute';
import '@/styles/Landing.css';

type Visitor =
	| { name: 'checking' }
	| { name: 'guest' }
	| { name: 'member'; profile: Profile | null; stats: ProfileStats | null }
	| { name: 'unavailable'; reason: UnavailableReason };

/** "IDLE" in hills tiles, "REALM" smaller below. The name comes from `GAME_TITLE` ("Idle Realm"): the first word big, the rest small. */
const Banner: React.FC = () => {
	const [big, ...rest] = GAME_TITLE.split(' ');
	return (
		<header className='ld-banner'>
			<h1 aria-label={GAME_TITLE}>
				<span className='ld-title-big' aria-hidden='true'>
					{big.toUpperCase()}
				</span>
				<span className='ld-title-small' aria-hidden='true'>
					{rest.join(' ').toUpperCase()}
				</span>
			</h1>
			<p className='ld-tagline'>Build a realm. Leave it running. Come back to a bigger one.</p>
		</header>
	);
};

const FeatureCard: React.FC<{ feature: LandingFeature }> = ({ feature }) => (
	<li className='ld-card'>
		<span className='ld-card-icon'>
			<PixelIcon name={feature.icon} />
		</span>
		<span>
			<h3 className='ld-card-title'>{feature.title}</h3>
			<p className='ld-card-text'>{feature.text}</p>
		</span>
	</li>
);

/** The Continue card for a signed-in visitor: who they are and the way into the game. Read-only. */
const ContinueCard: React.FC<{ profile: Profile | null; stats: ProfileStats | null; onLogout: () => void }> = ({ profile, stats, onLogout }) => {
	if (!profile) {
		return (
			<div className='ld-continue'>
				<p>Your account is ready. One step left: choose a name and a hero.</p>
				<Link className='px-btn ld-continue-go' href={PLAY_PATH}>
					Finish your hero
				</Link>
				<button type='button' className='ld-link' onClick={onLogout}>
					Log out
				</button>
			</div>
		);
	}
	const info = PLAYER_CLASSES[profile.playerClass];
	return (
		<div className='ld-continue'>
			<div className='ld-continue-figure'>
				<PixelIcon name={info.bust} scale={2} alt={`${info.race} ${info.label}`} />
			</div>
			<p className='ld-continue-name'>{profile.characterName}</p>
			<p className='ld-continue-class'>
				{info.race} {info.label}
			</p>
			{stats && (
				<p className='ld-continue-stats'>
					Level {stats.level} · {stats.rebirths} {stats.rebirths === 1 ? 'rebirth' : 'rebirths'}
				</p>
			)}
			<Link className='px-btn ld-continue-go' href={PLAY_PATH}>
				Continue
			</Link>
			<button type='button' className='ld-link' onClick={onLogout}>
				Log out
			</button>
		</div>
	);
};

const WindowHead: React.FC<{ title: string }> = ({ title }) => (
	<div className='px-modal-head'>
		<span className='px-title-line' />
		<h2 className='px-title'>{title}</h2>
		<span className='px-title-line rev' />
	</div>
);

/** The public landing page: banner, a login / register window (a bottom sheet on phones), five feature cards and, for a signed-in visitor, the Continue card. */
const LandingPage: React.FC = () => {
	const router = useRouter();
	const [visitor, setVisitor] = useState<Visitor>({ name: 'checking' });
	const [mode, setMode] = useState<AuthMode>('login');
	const [formKey, setFormKey] = useState(0);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [next, setNext] = useState<string>(PLAY_PATH);

	const look = useCallback(async () => {
		const me = await fetchMe();
		if (me.status === 'ok') setVisitor({ name: 'member', profile: me.profile, stats: me.stats ?? null });
		else if (me.status === 'guest') setVisitor({ name: 'guest' });
		else setVisitor({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
	}, []);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setNext(safeNextPath(params.get('next')));
		if (params.get('login') === '1') setSheetOpen(true); // a guest sent here from /play: on a phone the sheet opens by itself
		void look();
	}, [look]);

	const pickMode = (picked: AuthMode) => {
		setMode(picked);
		setFormKey((k) => k + 1);
	};

	const leave = async () => {
		await logout();
		setVisitor({ name: 'guest' });
	};

	const signedIn = () => router.push(next); // /play runs the gate (profile, new chapter, save hub)

	return (
		<main className='ld-root'>
			<div className='ld-backdrop' aria-hidden='true'>
				{LANDING_BIOMES.map((biome, i) => (
					<div
						key={biome}
						className='ld-band'
						style={{ top: `${(i * 100) / LANDING_BIOMES.length - 4}%`, backgroundImage: `url(/pixel/bg/ground_${biome}.png)` }}
					/>
				))}
				<div className='ld-shade' />
			</div>

			<div className='ld-content'>
				<Banner />

				<div className='ld-stage'>
					<ul className='ld-cards ld-cards-left'>
						{LANDING_FEATURES.slice(0, 3).map((f) => (
							<FeatureCard key={f.id} feature={f} />
						))}
					</ul>

					<section className='ld-window-wrap' aria-label='Account'>
						{visitor.name === 'guest' && (
							<button type='button' className='px-btn ld-open-sheet' onClick={() => setSheetOpen(true)}>
								Log in / Register
							</button>
						)}
						{visitor.name === 'member' && (
							<div className='px-modal ld-window ld-window-continue'>
								<WindowHead title='Welcome back' />
								<div className='px-modal-body'>
									<ContinueCard profile={visitor.profile} stats={visitor.stats} onLogout={() => void leave()} />
								</div>
							</div>
						)}
						{(visitor.name === 'guest' || visitor.name === 'unavailable') && (
							<div className='px-modal ld-window' data-open={sheetOpen}>
								<button type='button' className='px-close ld-sheet-close' onClick={() => setSheetOpen(false)} aria-label='Close'>
									✕
								</button>
								<WindowHead title={visitor.name === 'unavailable' ? 'Accounts unavailable' : authTitle(mode)} />
								<div className='px-modal-body'>
									{visitor.name === 'unavailable' ? (
										<div className='ld-continue'>
											<p>
												{visitor.reason === 'not_configured'
													? 'This server has no accounts set up, so nobody can log in here.'
													: 'The account service is not answering right now. It usually passes in a minute.'}
											</p>
											{visitor.reason === 'outage' && (
												<button type='button' className='px-btn' onClick={() => void look()}>
													Try again
												</button>
											)}
										</div>
									) : (
										<>
											<div className='ld-tabs' role='tablist'>
												{(['login', 'register'] as const).map((tab) => (
													<button key={tab} type='button' role='tab' aria-selected={mode === tab} className='ld-tab' onClick={() => pickMode(tab)}>
														{tab === 'login' ? 'Log in' : 'Create account'}
													</button>
												))}
											</div>
											<AuthForm
												key={formKey}
												initialMode={mode === 'register' ? 'register' : 'login'}
												onSignedIn={signedIn}
												onUnavailable={() => setVisitor({ name: 'unavailable', reason: 'outage' })}
												onModeChange={setMode}
											/>
										</>
									)}
								</div>
							</div>
						)}
					</section>

					<ul className='ld-cards ld-cards-right'>
						{LANDING_FEATURES.slice(3).map((f) => (
							<FeatureCard key={f.id} feature={f} />
						))}
					</ul>
				</div>

				<footer className='ld-footer'>{GAME_TITLE}</footer>
			</div>
		</main>
	);
};

export default LandingPage;
