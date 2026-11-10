'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthForm, { authTitle, type AuthMode } from '@/components/auth/AuthForm';
import PixelIcon from '@/components/game/PixelIcon';
import { CHANGELOG } from '@/config/changelog';
import { GAME_TITLE } from '@/config/branding';
import { LANDING_FEATURES, LANDING_MAP, type LandingFeature } from '@/config/landing';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { fetchMe, logout, type Profile, type ProfileStats, type UnavailableReason } from '@/lib/authClient';
import { PLAY_PATH, safeNextPath } from '@/lib/playRoute';
import '@/styles/Landing.css';

/** The size the landing is designed for (content width, and the height from the top of the map to the bottom of the feature cards). */
const DESIGN_W = 1300;
const DESIGN_H = 1030;

type Visitor =
	| { name: 'checking' }
	| { name: 'guest' }
	| { name: 'member'; profile: Profile | null; stats: ProfileStats | null }
	| { name: 'unavailable'; reason: UnavailableReason };

/** A monster from the game sitting on the edge of a box. */
const Critter: React.FC<{ id: string; size?: number; className?: string }> = ({ id, size = 56, className }) => (
	<Image src={`/pixel/enemies/${id}.png`} alt='' width={size} height={size} unoptimized draggable={false} className={`ld-critter pixelated ${className ?? ''}`} />
);

/** A pixel-art crown (15 x 8 cells): gold with a darker band and three gems. */
const CROWN_ROWS = ['.#.....#.....#.', '.##...###...##.', '.###.#####.###.', '.#############.', '.#############.', '.#############.', '.=============.', '.=============.'];
const Crown: React.FC = () => (
	<svg className='ld-crown' viewBox='0 0 15 8' width={120} height={64} shapeRendering='crispEdges' aria-hidden='true'>
		{CROWN_ROWS.flatMap((row, y) =>
			row.split('').map((c, x) => (c === '.' ? null : <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={c === '#' ? '#f0d27a' : '#c08a30'} />)),
		)}
		<rect x={3} y={4} width={1} height={1} fill='#4aa3e8' />
		<rect x={7} y={4} width={1} height={1} fill='#e04a4a' />
		<rect x={11} y={4} width={1} height={1} fill='#4aa3e8' />
	</svg>
);

/** The title: IDLE is written on the land itself (hills in the baked map); here the REALM stamp, the crown and the tagline sit under it, inside the drifting map so they move together. */
const TitleBlock: React.FC = () => {
	const rest = GAME_TITLE.split(' ').slice(1).join(' ').toUpperCase();
	return (
		<div className='ld-title'>
			<h1 aria-label={GAME_TITLE}>
				<Crown />
				<span className='ld-stamp' aria-hidden='true'>
					{rest}
				</span>
			</h1>
			<p className='ld-tagline'>Build a realm. Leave it running. Come back to a bigger one.</p>
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

const ChangelogWindow: React.FC = () => (
	<div className='px-modal ld-window'>
		<Critter id='forest/mossback-wolf' className='ld-critter-tl' />
		<Critter id='coast/wreck-crab' size={48} className='ld-critter-bl' />
		<WindowHead title='Changelog' />
		<div className='px-modal-body ld-log'>
			{CHANGELOG.map((entry) => (
				<article key={entry.date + entry.title}>
					<p className='ld-log-date'>{entry.date}</p>
					<h3 className='ld-log-title'>{entry.title}</h3>
					<ul>
						{entry.items.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</article>
			))}
		</div>
	</div>
);

const FeatureCard: React.FC<{ feature: LandingFeature }> = ({ feature }) => (
	<li className='ld-card'>
		<Critter id={feature.critter} size={48} className='ld-critter-top' />
		<div className='ld-card-head'>
			<span className='ld-card-icon'>
				<PixelIcon name={feature.icon} />
			</span>
			<h3 className='ld-card-title'>{feature.title}</h3>
		</div>
		<p className='ld-card-text'>{feature.text}</p>
	</li>
);

/** The hero card for a signed-in visitor: portrait, name, class, level and rebirths, and the way into the game (Enter). Read-only. */
const MemberCard: React.FC<{ profile: Profile | null; stats: ProfileStats | null; onLogout: () => void }> = ({ profile, stats, onLogout }) => {
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
			<Link className='px-btn ld-continue-go' href={PLAY_PATH} autoFocus>
				Enter the realm
			</Link>
			<p className='ld-hint'>or press Enter</p>
			<button type='button' className='ld-link' onClick={onLogout}>
				Not you? Log out
			</button>
		</div>
	);
};

/** The public landing page: the baked map with the title, a changelog window and the account window (login / register, or the hero card with Enter), and the five feature cards. */
const LandingPage: React.FC = () => {
	const router = useRouter();
	const [visitor, setVisitor] = useState<Visitor>({ name: 'checking' });
	const [mode, setMode] = useState<AuthMode>('login');
	const [formKey, setFormKey] = useState(0);
	const [next, setNext] = useState<string>(PLAY_PATH);
	const [zoom, setZoom] = useState(1);

	const look = useCallback(async () => {
		const me = await fetchMe();
		if (me.status === 'ok') setVisitor({ name: 'member', profile: me.profile, stats: me.stats ?? null });
		else if (me.status === 'guest') setVisitor({ name: 'guest' });
		else setVisitor({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
	}, []);

	// the page is laid out for DESIGN_W x DESIGN_H css px and scaled to fit whatever screen it is on (a big screen gets it bigger, not lost in a corner)
	useEffect(() => {
		const fit = () => setZoom(Math.min(1.5, Math.max(0.5, Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H))));
		fit();
		window.addEventListener('resize', fit);
		return () => window.removeEventListener('resize', fit);
	}, []);

	useEffect(() => {
		setNext(safeNextPath(new URLSearchParams(window.location.search).get('next')));
		void look();
	}, [look]);

	// Enter takes a signed-in visitor into the game (a guest's Enter submits the form as usual)
	useEffect(() => {
		if (visitor.name !== 'member') return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) router.push(PLAY_PATH);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [visitor.name, router]);

	const pickMode = (picked: AuthMode) => {
		setMode(picked);
		setFormKey((k) => k + 1);
	};

	const leave = async () => {
		await logout();
		setVisitor({ name: 'guest' });
	};

	return (
		<main className='ld-root' style={{ '--ld-zoom': zoom } as React.CSSProperties}>
			<div className='ld-mapwrap'>
				<div className='ld-map' style={{ backgroundImage: `url(${LANDING_MAP.src})`, width: LANDING_MAP.width * LANDING_MAP.scale, height: LANDING_MAP.height * LANDING_MAP.scale, marginLeft: (-LANDING_MAP.width * LANDING_MAP.scale) / 2 }}>
					<TitleBlock />
				</div>
			</div>

			<div className='ld-content'>
				<div className='ld-columns'>
					<ChangelogWindow />

					<div className='px-modal ld-window'>
						<Critter id='swamp/rot-heron' className='ld-critter-tr' />
						{visitor.name === 'member' ? (
							<>
								<WindowHead title='Welcome back' />
								<div className='px-modal-body'>
									<MemberCard profile={visitor.profile} stats={visitor.stats} onLogout={() => void leave()} />
								</div>
							</>
						) : (
							<>
								<WindowHead title={visitor.name === 'unavailable' ? 'Accounts unavailable' : authTitle(mode)} />
								<div className='px-modal-body'>
									{visitor.name === 'checking' && <p className='ld-hint'>Looking for your hero...</p>}
									{visitor.name === 'unavailable' && (
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
									)}
									{visitor.name === 'guest' && (
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
												onSignedIn={() => router.push(next)} // /play runs the gate (profile, new chapter, save hub)
												onUnavailable={() => setVisitor({ name: 'unavailable', reason: 'outage' })}
												onModeChange={setMode}
											/>
										</>
									)}
								</div>
							</>
						)}
					</div>
				</div>

				<ul className='ld-features'>
					{LANDING_FEATURES.map((f) => (
						<FeatureCard key={f.id} feature={f} />
					))}
				</ul>
			</div>
		</main>
	);
};

export default LandingPage;
