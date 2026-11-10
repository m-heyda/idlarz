'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthForm, { authTitle, type AuthMode } from '@/components/auth/AuthForm';
import PixelIcon from '@/components/game/PixelIcon';
import type { ChangelogEntry } from '@/config/changelog';
import { GAME_TITLE } from '@/config/branding';
import { LANDING_FEATURES, LANDING_MAP, fitZoom, type LandingFeature } from '@/config/landing';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { fetchCloud, readLink } from '@/lib/cloudClient';
import { epochVerdict, readSeenEpoch } from '@/lib/epochGuard';
import { peekSave } from '@/lib/saveStorage';
import { planStart, savedGameSummary, skipsHub, type GameSummary } from '@/lib/startPlan';
import { fetchMe, logout, type Profile, type ProfileStats, type UnavailableReason } from '@/lib/authClient';
import { PLAY_PATH, safeNextPath } from '@/lib/playRoute';
import '@/styles/Landing.css';

type Visitor =
	| { name: 'checking' }
	| { name: 'guest' }
	| { name: 'member'; profile: Profile | null; stats: ProfileStats | null; game: GameSummary | null; asks: boolean }
	| { name: 'unavailable'; reason: UnavailableReason };

/** A monster from the game sitting on the edge of a box. */
const Critter: React.FC<{ id: string; size?: number; className?: string }> = ({ id, size = 56, className }) => (
	<Image
		src={`/pixel/enemies/${id}.png`}
		alt=''
		width={size}
		height={size}
		unoptimized
		draggable={false}
		className={`ld-critter pixelated ${className ?? ''}`}
	/>
);

/** A pixel-art crown (15 x 8 cells): gold with a darker band and three gems. */
const CROWN_ROWS = [
	'.#.....#.....#.',
	'.##...###...##.',
	'.###.#####.###.',
	'.#############.',
	'.#############.',
	'.#############.',
	'.=============.',
	'.=============.',
];
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

/** The title: IDLE is written on the land itself (hills in the baked map); here the REALM stamp, the crown and the tagline sit under it, on top of the drifting map but standing still (only the map moves). */
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

/** What the account window shows while it looks for a session: the shape of the login form, so nothing jumps when the real content arrives. */
const Skeleton: React.FC = () => (
	<div className='ld-skel' role='status' aria-label='Looking for your hero'>
		<span className='ld-skel-bar ld-skel-tabs' />
		<span className='ld-skel-bar ld-skel-input' />
		<span className='ld-skel-bar ld-skel-input' />
		<span className='ld-skel-bar ld-skel-button' />
	</div>
);

/** Renders `**bold**` as <strong>; everything else is plain text (no html is ever injected). */
const Inline: React.FC<{ text: string }> = ({ text }) => <>{text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</>;

const ChangelogRow: React.FC<{ entry: ChangelogEntry; open: boolean; onToggle: () => void }> = ({ entry, open, onToggle }) => {
	const panelId = `ld-log-${entry.version}`;
	return (
		<article className='ld-log-entry'>
			<button type='button' className='ld-log-head' aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
				<span className='ld-log-caret' aria-hidden='true'>
					{open ? '▾' : '▸'}
				</span>
				<span className='ld-log-version'>{entry.version}</span>
				<span className='ld-log-title'>{entry.title}</span>
				<span className='ld-log-date'>{entry.date}</span>
			</button>
			<div id={panelId} className='ld-log-body' hidden={!open}>
				{entry.body.map((block, i) =>
					block.kind === 'p' ? (
						<p key={i}>
							<Inline text={block.text} />
						</p>
					) : (
						<ul key={i}>
							{block.items.map((item) => (
								<li key={item}>
									<Inline text={item} />
								</li>
							))}
						</ul>
					),
				)}
			</div>
		</article>
	);
};

/** The release notes, one collapsible row per version in a fixed-height scroll area (the newest starts open). */
const ChangelogWindow: React.FC<{ entries: readonly ChangelogEntry[] }> = ({ entries }) => {
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(entries.slice(0, 1).map((e) => e.version)));
	const toggle = (version: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (!next.delete(version)) next.add(version);
			return next;
		});
	return (
		<div className='px-modal ld-window'>
			<Critter id='forest/mossback-wolf' className='ld-critter-tl' />
			<Critter id='coast/wreck-crab' size={48} className='ld-critter-bl' />
			<WindowHead title='Changelog' />
			<div className='px-modal-body ld-log'>
				{entries.map((entry) => (
					<ChangelogRow key={entry.version} entry={entry} open={open.has(entry.version)} onToggle={() => toggle(entry.version)} />
				))}
			</div>
		</div>
	);
};

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
const MemberCard: React.FC<{ profile: Profile | null; stats: ProfileStats | null; game: GameSummary | null; asks: boolean; onLogout: () => void }> = ({
	profile,
	stats,
	game,
	asks,
	onLogout,
}) => {
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
			<p className='ld-continue-stats'>
				{game ? `Level ${game.level} · ${game.tiles} tiles` : stats ? `Level ${stats.level}` : 'A new game awaits'}
				{stats ? ` · ${stats.rebirths} ${stats.rebirths === 1 ? 'rebirth' : 'rebirths'}` : ''}
			</p>
			<Link className='px-btn ld-continue-go' href={PLAY_PATH} autoFocus>
				Enter the realm
			</Link>
			<p className='ld-hint'>{asks ? 'We will ask which save to keep' : 'or press Enter'}</p>
			<div className='ld-links'>
				<button type='button' className='ld-link' onClick={onLogout}>
					Not you? Log out
				</button>
				{game && (
					<Link className='ld-link' href={`${PLAY_PATH}?hub=1`}>
						Start over...
					</Link>
				)}
			</div>
		</div>
	);
};

/** The public landing page: the baked map with the title, a changelog window and the account window (login / register, or the hero card with Enter), and the five feature cards. */
const LandingPage: React.FC<{ changelog: readonly ChangelogEntry[] }> = ({ changelog }) => {
	const router = useRouter();
	const [visitor, setVisitor] = useState<Visitor>({ name: 'checking' });
	const [mode, setMode] = useState<AuthMode>('login');
	const [formKey, setFormKey] = useState(0);
	const [next, setNext] = useState<string>(PLAY_PATH);
	const [zoom, setZoom] = useState<number | null>(null); // null until measured: the page script in app/page.tsx has set the same value before the first paint

	const look = useCallback(async () => {
		const me = await fetchMe();
		if (me.status === 'ok') {
			// the start check happens here already: what this browser and the account hold, so the Continue card shows the game and /play goes straight in
			let game: GameSummary | null = null;
			let asks = false;
			const stale = me.needsReset === true || epochVerdict(readSeenEpoch(), me.epoch) === 'wipe'; // an older chapter's game: /play puts it aside, the card shows nothing of it
			if (me.profile && !stale) {
				const local = peekSave();
				const fetched = await fetchCloud();
				const cloud = fetched.status === 'ok' ? fetched.cloud : fetched.status === 'empty' ? null : 'unavailable';
				game = savedGameSummary(local, cloud);
				asks = !skipsHub(planStart(local, cloud, readLink(), me.userId), local);
			}
			setVisitor({ name: 'member', profile: me.profile, stats: stale ? null : (me.stats ?? null), game, asks });
		} else if (me.status === 'guest') setVisitor({ name: 'guest' });
		else setVisitor({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
	}, []);

	// the page is laid out for `LANDING_DESIGN` css px and scaled to fit whatever screen it is on (a big screen gets it bigger, not lost in a corner)
	useEffect(() => {
		const fit = () => setZoom(fitZoom(window.innerWidth, window.innerHeight));
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
		<main className='ld-root' style={zoom === null ? undefined : ({ '--ld-zoom': zoom } as React.CSSProperties)}>
			<div className='ld-mapwrap'>
				<div
					className='ld-map'
					style={{
						backgroundImage: `url(${LANDING_MAP.src})`,
						width: LANDING_MAP.width * LANDING_MAP.scale,
						height: LANDING_MAP.height * LANDING_MAP.scale,
						marginLeft: (-LANDING_MAP.width * LANDING_MAP.scale) / 2,
					}}
				/>
				<TitleBlock />
			</div>

			<div className='ld-content'>
				<div className='ld-columns'>
					<ChangelogWindow entries={changelog} />

					<div className='px-modal ld-window ld-account'>
						<Critter id='swamp/rot-heron' className='ld-critter-tr' />
						{visitor.name === 'member' ? (
							<>
								<WindowHead title='Welcome back' />
								<div className='px-modal-body'>
									<MemberCard profile={visitor.profile} stats={visitor.stats} game={visitor.game} asks={visitor.asks} onLogout={() => void leave()} />
								</div>
							</>
						) : (
							<>
								<WindowHead title={visitor.name === 'unavailable' ? 'Accounts unavailable' : authTitle(mode)} />
								<div className='px-modal-body'>
									{visitor.name === 'checking' && <Skeleton />}
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
