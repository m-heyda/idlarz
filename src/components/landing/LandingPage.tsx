'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthForm, { authTitle, type AuthMode } from '@/components/auth/AuthForm';
import AvatarArt from '@/components/game/AvatarArt';
import AwayBar from '@/components/game/AwayBar';
import { resolveAvatar } from '@/catalog/avatars';
import { nickColorValue } from '@/config/nickColors';
import type { ShownIdentity } from '@/catalog/badges';
import type { ChangelogEntry } from '@/config/changelog';
import { GAME_TITLE } from '@/config/branding';
import { LANDING_BG } from '@/config/landing';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { fetchCloud, readLink } from '@/lib/cloudClient';
import { epochVerdict, readSeenEpoch } from '@/lib/epochGuard';
import { peekSave } from '@/lib/saveStorage';
import { localForAccount, planStart, savedGameSummary, skipsHub, type GameSummary } from '@/lib/startPlan';
import { clearBootSnapshot } from '@/lib/bootSnapshot';
import { fetchMe, logout, type AwayInfo, type Profile, type ProfileStats, type UnavailableReason } from '@/lib/authClient';
import { PLAY_PATH, safeNextPath } from '@/lib/playRoute';
import '@idlarz/design-system';
import { Button, Frame, Panel, Tabs } from '../../../packages/design-system/src/components/primitives';
import { NickName } from '../../../packages/design-system/src/components/composites';
import '@/styles/Landing.css';

type Visitor =
	| { name: 'checking' }
	| { name: 'guest' }
	| {
			name: 'member';
			profile: Profile | null;
			stats: ProfileStats | null;
			game: GameSummary | null;
			asks: boolean;
			away: AwayInfo | null;
			identity: ShownIdentity | null;
	  }
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

/** The title row of a frame: a gold rule, the title, a gold rule (the design system's modal heading). */
const WindowHead: React.FC<{ title: string }> = ({ title }) => <div className='ds-modal-title ld-head'>{title}</div>;

/** The eight pixels of the spinner ring (8 px squares on a 64 px grid); each one lights up a step after the one before it (see `.ld-spinner` in Landing.css). */
const SPINNER_PIXELS: readonly (readonly [number, number])[] = [
	[28, 4],
	[44, 12],
	[52, 28],
	[44, 44],
	[28, 52],
	[12, 44],
	[4, 28],
	[12, 12],
];

/** What the account window shows while it looks for a session: a pixel spinner (the window keeps its height, so nothing jumps when the real content arrives). */
const Skeleton: React.FC = () => (
	<div className='ld-skel' role='status' aria-label='Looking for your hero'>
		<svg className='ld-spinner' viewBox='0 0 64 64' aria-hidden='true' shapeRendering='crispEdges'>
			{SPINNER_PIXELS.map(([x, y], i) => (
				<rect key={i} x={x} y={y} width={8} height={8} style={{ '--i': i } as React.CSSProperties} />
			))}
		</svg>
		<span className='ld-skel-text'>Looking for your hero…</span>
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

/** The release notes on a parchment sheet: one collapsible row per version in a scroll area that fills the frame (the newest starts open). */
const ChangelogWindow: React.FC<{ entries: readonly ChangelogEntry[]; collapsed: boolean; canCollapse: boolean; onToggle: () => void }> = ({
	entries,
	collapsed,
	canCollapse,
	onToggle,
}) => {
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(entries.slice(0, 1).map((e) => e.version)));
	const toggle = (version: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (!next.delete(version)) next.add(version);
			return next;
		});
	return (
		<div className='ld-col ld-col-log' data-collapsed={collapsed}>
			<Critter id='forest/mossback-wolf' className='ld-critter-tl' />
			<Critter id='coast/wreck-crab' size={48} className='ld-critter-bl' />
			<Frame className='ld-frame'>
				<div className='ld-log-inner' aria-hidden={collapsed}>
					<div className='ld-log-headrow'>
						<WindowHead title='Changelog' />
						{canCollapse && (
							<button type='button' className='ld-fold' onClick={onToggle} aria-label='Collapse the changelog' title='Collapse'>
								◂
							</button>
						)}
					</div>
					<Panel parchment className='ld-paper'>
						{entries.map((entry) => (
							<ChangelogRow key={entry.version} entry={entry} open={open.has(entry.version)} onToggle={() => toggle(entry.version)} />
						))}
					</Panel>
				</div>
				{/* folded away while the hero is being made: a thin strip that opens it again */}
				<button type='button' className='ld-log-tab' onClick={onToggle} tabIndex={collapsed ? 0 : -1} aria-label='Show the changelog'>
					<span>▸</span>
					<b>Changelog</b>
				</button>
			</Frame>
		</div>
	);
};

/** The hero card for a signed-in visitor: portrait, name, class, level and rebirths, and the way into the game (Enter). Read-only. */
const MemberCard: React.FC<{
	profile: Profile | null;
	stats: ProfileStats | null;
	game: GameSummary | null;
	asks: boolean;
	away: AwayInfo | null;
	identity: ShownIdentity | null;
	onLogout: () => void;
}> = ({ profile, stats, game, asks, away, identity, onLogout }) => {
	if (!profile) {
		return (
			<div className='ld-continue'>
				<p>Your account is ready. One step left: choose a name and a hero.</p>
				<Link className='ds-btn ds-btn-gold ld-continue-go' href={PLAY_PATH}>
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
				<AvatarArt id={resolveAvatar(profile.avatarId, profile.playerClass).id} playerClass={profile.playerClass} scale={2} />
			</div>
			<p className='ld-continue-name'>
				<NickName color={nickColorValue(identity?.nameColor)}>{profile.characterName}</NickName>
				{identity?.title && <span className='ld-continue-title'> ({identity.title})</span>}
				{identity?.badge && (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						className='early-tester-badge pixelated'
						src={`/pixel/new_assets/achievements/${identity.badge}.png`}
						alt={identity.badgeName ?? ''}
						title={identity.badgeName ?? undefined}
						width={26}
						height={26}
						draggable={false}
					/>
				)}
			</p>
			<p className='ld-continue-class'>
				{info.race} {info.label}
			</p>
			<p className='ld-continue-stats'>
				{game ? `Level ${game.level} · ${game.tiles} tiles` : stats ? `Level ${stats.level}` : 'A new game awaits'}
				{stats ? ` · ${stats.rebirths} ${stats.rebirths === 1 ? 'rebirth' : 'rebirths'}` : ''}
			</p>
			{away && <AwayBar gapSec={away.gapSec} capSec={away.capSec} efficiency={away.efficiency} className='ld-away' />}
			<Link className='ds-btn ds-btn-gold ld-continue-go' href={PLAY_PATH} autoFocus>
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

/** The public landing page: the realm picture fills the screen (slowly zooming in and out), with the changelog on parchment on the left and the account window (login / register, or the hero card with Enter) on the right. */
const LandingPage: React.FC<{ changelog: readonly ChangelogEntry[] }> = ({ changelog }) => {
	const router = useRouter();
	const [visitor, setVisitor] = useState<Visitor>({ name: 'checking' });
	const [mode, setMode] = useState<AuthMode>('login');
	const [formKey, setFormKey] = useState(0);
	const [next, setNext] = useState<string>(PLAY_PATH);

	const look = useCallback(async () => {
		const me = await fetchMe();
		if (me.status === 'ok') {
			// the start check happens here already: what this browser and the account hold, so the Continue card shows the game and /play goes straight in
			let game: GameSummary | null = null;
			let asks = false;
			const stale = me.needsReset === true || epochVerdict(readSeenEpoch(), me.epoch) === 'wipe'; // an older chapter's game: /play puts it aside, the card shows nothing of it
			if (me.profile && !stale) {
				const local = localForAccount(peekSave(), readLink(), me.userId);
				const fetched = await fetchCloud();
				const cloud = fetched.status === 'ok' ? fetched.cloud : fetched.status === 'empty' ? null : 'unavailable';
				game = savedGameSummary(local, cloud);
				asks = !skipsHub(planStart(local, cloud, readLink(), me.userId), local);
			}
			// the away bar and the badge and title follow the same stale-epoch rule as the stats: an older chapter's numbers are not shown
			setVisitor({
				name: 'member',
				profile: me.profile,
				stats: stale ? null : (me.stats ?? null),
				game,
				asks,
				away: stale ? null : (me.away ?? null),
				identity: stale ? null : (me.identity ?? null),
			});
		} else if (me.status === 'guest') setVisitor({ name: 'guest' });
		else setVisitor({ name: 'unavailable', reason: me.status === 'unavailable' ? me.reason : 'outage' });
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

	// making a hero needs the room: the changelog folds to a strip on the left and the window grows (the strip opens it again)
	const wide = visitor.name === 'guest' && mode === 'register';
	const [logPeek, setLogPeek] = useState(false);
	useEffect(() => setLogPeek(false), [wide]);
	const collapsed = wide && !logPeek;

	const pickMode = (picked: AuthMode) => {
		setMode(picked);
		setFormKey((k) => k + 1);
	};

	const leave = async () => {
		await logout();
		clearBootSnapshot();
		setVisitor({ name: 'guest' });
	};

	return (
		<main className='ld-root ds-root' data-wide={wide && collapsed}>
			<div className='ld-bg' style={{ backgroundImage: `url(${LANDING_BG})` }} aria-hidden='true' />
			<div className='ld-shade' aria-hidden='true' />
			<h1 className='sr-only'>{GAME_TITLE}</h1>

			<div className='ld-layout'>
				<ChangelogWindow entries={changelog} collapsed={collapsed} canCollapse={wide} onToggle={() => setLogPeek((p) => !p)} />

				<div className='ld-col ld-col-account'>
					<Critter id='swamp/rot-heron' className='ld-critter-tr' />
					<Frame className='ld-frame'>
						{visitor.name === 'member' ? (
							<>
								<WindowHead title='Welcome back' />
								<div className='ld-account-body'>
									<MemberCard
										profile={visitor.profile}
										stats={visitor.stats}
										game={visitor.game}
										asks={visitor.asks}
										away={visitor.away}
										identity={visitor.identity}
										onLogout={() => void leave()}
									/>
								</div>
							</>
						) : (
							<>
								<WindowHead title={visitor.name === 'unavailable' ? 'Accounts unavailable' : authTitle(mode)} />
								<div className='ld-account-body'>
									{visitor.name === 'checking' && <Skeleton />}
									{visitor.name === 'unavailable' && (
										<div className='ld-continue'>
											<p>
												{visitor.reason === 'not_configured'
													? 'This server has no accounts set up, so nobody can log in here.'
													: 'The account service is not answering right now. It usually passes in a minute.'}
											</p>
											{visitor.reason === 'outage' && <Button onClick={() => void look()}>Try again</Button>}
										</div>
									)}
									{visitor.name === 'guest' && (
										<>
											<div className='ld-form-tabs'>
												<Tabs
													active={mode === 'register' ? 'register' : 'login'}
													onChange={(id) => pickMode(id as AuthMode)}
													items={[
														{ id: 'login', label: 'Log in' },
														{ id: 'register', label: 'Create account' },
													]}
												/>
											</div>
											<div className='ld-form'>
												<AuthForm
													key={formKey}
													initialMode={mode === 'register' ? 'register' : 'login'}
													onSignedIn={() => router.push(next)} // /play runs the gate (profile, new chapter, save hub)
													onUnavailable={() => setVisitor({ name: 'unavailable', reason: 'outage' })}
													onModeChange={setMode}
												/>
											</div>
										</>
									)}
								</div>
							</>
						)}
					</Frame>
				</div>
			</div>

			<p className='ld-tagline'>Build a realm. Leave it running. Come back to a bigger one.</p>
		</main>
	);
};

export default LandingPage;
