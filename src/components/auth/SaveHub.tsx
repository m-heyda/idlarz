'use client';

import React, { useState } from 'react';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import { archiveForNewGame, resetSave, type SavePeek } from '@/lib/saveStorage';
import type { CloudInfo } from '@/lib/startPlan';
import { countOwnedTiles } from '@/utils/gameUtils';
import PixelModal from '@/components/game/PixelModal';
import PixelIcon from '@/components/game/PixelIcon';

export type HubChoice = 'local' | 'cloud' | 'fresh';

interface Props {
	/** local: Continue this browser's save. cloud: Continue the account's save. choose: both exist, pick one. */
	mode: 'local' | 'cloud' | 'choose';
	local: SavePeek;
	cloud: CloudInfo | null;
	/** Returns an error message when the choice could not be carried out (nothing was changed then). */
	onEnter: (choice: HubChoice) => string | null;
	/** The old game is archived and wiped: start over with the account's character. */
	onNewGame: () => void;
	onLogout: () => void;
}

const NOOP = () => {};

const playTime = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
};

interface CardProps {
	title: string;
	name?: string;
	bust?: React.ReactNode;
	level: number;
	tiles: number;
	playSeconds: number;
	note?: string;
	action?: { label: string; onClick: () => void; blue?: boolean };
}

const SaveCard: React.FC<CardProps> = ({ title, name, bust, level, tiles, playSeconds, note, action }) => (
	<div className='flex flex-col items-center gap-1 flex-1 min-w-[170px]'>
		<div className='text-xs uppercase tracking-wide text-[#a89878]'>{title}</div>
		{bust}
		{name && <div className='text-lg'>{name}</div>}
		<div className='text-sm text-[#a89878] text-center'>
			Level {level} · {tiles} tiles
			<br />
			{playTime(playSeconds)} played
		</div>
		{note && <p className='text-xs text-[#e0a040] text-center mt-1'>{note}</p>}
		{action && (
			<button className={action.blue ? 'px-btn px-btn-blue mt-2' : 'px-btn mt-2'} onClick={action.onClick}>
				{action.label}
			</button>
		)}
	</div>
);

/**
 * The start hub for a player who has a saved game here, in their account, or both. Continue keeps a game untouched;
 * whichever game is not chosen is copied aside first. New Game replaces everything after a confirm.
 */
const SaveHub: React.FC<Props> = ({ mode, local, cloud, onEnter, onNewGame, onLogout }) => {
	const [confirming, setConfirming] = useState(false);
	const [problem, setProblem] = useState<string | null>(null);

	const enter = (choice: HubChoice) => setProblem(onEnter(choice));

	const wipe = async () => {
		if (!archiveForNewGame()) {
			setProblem('The browser would not keep a copy of your current game, so it was not replaced. Export it from the save tools (Ctrl x5 in the game) first.');
			return;
		}
		await resetSave();
		onNewGame();
	};

	const localOk = local.kind === 'ok' ? local : null;
	const info = localOk ? PLAYER_CLASSES[localOk.state.playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS] : null;
	const localCard = (action?: CardProps['action']) =>
		localOk && info ? (
			<SaveCard
				title='This browser'
				name={localOk.state.playerName}
				bust={<PixelIcon name={info.bust} scale={3} alt={info.label} />}
				level={localOk.state.level.level}
				tiles={countOwnedTiles(localOk.state.tiles)}
				playSeconds={localOk.state.playSeconds}
				note={localOk.fromBackup ? 'Your latest save could not be read, so this is your previous backup.' : undefined}
				action={action}
			/>
		) : null;
	const cloudCard = (action?: CardProps['action']) =>
		cloud ? (
			<SaveCard
				title='Your account'
				level={cloud.summary.level}
				tiles={cloud.summary.tilesOwned}
				playSeconds={cloud.summary.playSeconds}
				note={cloud.serverSavedAt ? `Saved ${new Date(cloud.serverSavedAt).toLocaleString()}` : undefined}
				action={action}
			/>
		) : null;

	// nothing readable here and nothing in the account: only a new game is left
	if (mode === 'local' && local.kind === 'unreadable') {
		return (
			<div className='fixed inset-0 bg-[#14100c]'>
				<PixelModal title='Save unreadable' size='sm' hideClose closeOnBackdrop={false} onClose={NOOP}>
					<p className='text-sm text-center text-[#a89878] mb-4'>
						A saved game is stored in this browser but could not be read. A copy of the damaged text is kept; you can copy it from the save tools (Ctrl x5 in the game).
					</p>
					{problem && <p role='alert' className='text-xs text-center text-[#e07a6a] mb-2'>{problem}</p>}
					<div className='flex flex-col items-center gap-2'>
						<button className='px-btn' onClick={() => enter('fresh')}>Start a new game</button>
						<button type='button' className='text-xs text-[#a89878] underline' onClick={onLogout}>Log out</button>
					</div>
				</PixelModal>
			</div>
		);
	}

	const title = mode === 'choose' ? 'Which game to continue?' : 'Your kingdom awaits';

	return (
		<div className='fixed inset-0 bg-[#14100c]'>
			<PixelModal title={title} size={mode === 'choose' ? 'md' : 'sm'} hideClose closeOnBackdrop={false} onClose={NOOP}>
				{mode === 'choose' && (
					<p className='text-sm text-center text-[#a89878] mb-4'>
						This browser and your account hold different games. The one you do not pick is kept as a copy, nothing is deleted.
					</p>
				)}

				<div className='flex flex-wrap justify-center gap-6 mb-4'>
					{mode === 'local' && localCard({ label: 'Continue', onClick: () => enter('local'), blue: true })}
					{mode === 'cloud' && (
						<>
							{local.kind === 'unreadable' && (
								<p className='text-xs text-[#e0a040] text-center w-full'>The save in this browser could not be read, so your account&apos;s save is used. A copy of the damaged text is kept.</p>
							)}
							{cloudCard({ label: 'Continue', onClick: () => enter('cloud'), blue: true })}
						</>
					)}
					{mode === 'choose' && (
						<>
							{localCard({ label: 'Use this browser', onClick: () => enter('local') })}
							{cloudCard({ label: 'Use my account', onClick: () => enter('cloud'), blue: true })}
						</>
					)}
				</div>

				{problem && <p role='alert' className='text-xs text-center text-[#e07a6a] mb-3'>{problem}</p>}

				{!confirming ? (
					<div className='flex flex-col items-center gap-2'>
						<button className='px-btn' onClick={() => setConfirming(true)}>New Game</button>
						<button type='button' className='text-xs text-[#a89878] underline' onClick={onLogout}>Log out</button>
					</div>
				) : (
					<div className='flex flex-col items-center gap-3'>
						<p className='text-sm text-center text-[#e0a040]'>
							Start over? Your kingdom will be replaced by a fresh one{cloud ? ', here and in your account' : ''}. A copy of the old game is kept.
						</p>
						<div className='flex gap-2'>
							<button className='px-btn' onClick={() => { setConfirming(false); setProblem(null); }}>Keep playing</button>
							<button className='px-btn' onClick={wipe}>Yes, new game</button>
						</div>
					</div>
				)}
			</PixelModal>
		</div>
	);
};

export default SaveHub;
