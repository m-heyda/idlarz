'use client';

import React from 'react';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { AVATARS, CLASS_AVATARS, avatarById } from '@/catalog/avatars';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { describeClassPassives } from '@/lib/classPassives';
import AvatarArt from '@/components/game/AvatarArt';
import '@/styles/HeroCreator.css';

export interface HeroCreatorProps {
	name: string;
	onName: (name: string) => void;
	/** null: nothing chosen yet (the detail card shows a black silhouette and asks for a pick) */
	playerClass: PlayerClassId | null;
	onClass: (id: PlayerClassId) => void;
	/** The chosen avatar id; the class's default while the player has not picked one */
	avatarId: string | null;
	onAvatar: (id: string) => void;
	/** Ids of avatars the account has earned beyond the starters (shown as extra choices); a brand-new account has none */
	earned?: readonly string[];
	disabled?: boolean;
}

/** The silhouette shown before a class is chosen: any starter's cut-out, so the card has the same size and layout in both states (no jump when a class is picked). */
const SILHOUETTE_AVATAR = 'knight';

/**
 * The hero creation block shared by sign-up, "Finish your hero" and "A new chapter": the name, four class tabs and, for the chosen class, a detail card. The card leads with the
 * chosen avatar as a large portrait (drawn at 3x its native 64 px, so it stays sharp, with a slowly pulsing glow in the class colour), with its bio, and the two avatars the class owns
 * (plus earned extras) to switch between; beside it are the class's story, how it plays and its bonuses on one line (the real `CLASS_PASSIVES`, written out by `describeClassPassives`).
 * Before a class is chosen the same card shows a black silhouette, so nothing moves when one is picked. The server decides again on every save (`checkCreationAvatar`).
 */
const HeroCreator: React.FC<HeroCreatorProps> = ({ name, onName, playerClass, onClass, avatarId, onAvatar, earned = [], disabled = false }) => {
	const info = playerClass ? PLAYER_CLASSES[playerClass] : null;
	const bonuses = playerClass ? describeClassPassives(playerClass) : null;
	const extras = AVATARS.filter((avatar) => avatar.kind === 'unlock' && earned.includes(avatar.id));
	const shown = avatarById(avatarId);
	return (
		<div className='hero-creator'>
			<input
				type='text'
				className='px-input'
				placeholder={`Character name (${CHARACTER_NAME_MAX} chars max)`}
				maxLength={CHARACTER_NAME_MAX}
				value={name}
				onChange={(e) => onName(e.target.value)}
				aria-label='Character name'
				disabled={disabled}
			/>

			<div className='hero-tabs' role='radiogroup' aria-label='Hero'>
				{PLAYER_CLASS_ORDER.map((id) => {
					const tab = PLAYER_CLASSES[id];
					const selected = id === playerClass;
					return (
						<button
							key={id}
							type='button'
							role='radio'
							aria-checked={selected}
							className='hero-tab'
							data-selected={selected}
							disabled={disabled}
							style={{ '--accent': tab.accent } as React.CSSProperties}
							onClick={() => onClass(id)}
						>
							<span className='hero-tab-name'>{tab.label}</span>
							<span className='hero-tab-race'>{tab.race}</span>
						</button>
					);
				})}
			</div>

			<div className='hero-detail' data-empty={!info} style={info ? ({ '--accent': info.accent } as React.CSSProperties) : undefined} aria-live='polite'>
				<div className='hero-face'>
					<div className='hero-portrait'>
						{shown && info ? <AvatarArt id={shown.id} scale={4.8} /> : <AvatarArt id={SILHOUETTE_AVATAR} scale={4.8} locked />}
					</div>
					<div className='hero-face-name'>{info ? shown?.name : '???'}</div>
					<p className='hero-face-bio'>{info ? shown?.bio : 'Every hero has a face of its own.'}</p>
					<div className='hero-avatars' role='radiogroup' aria-label='Avatar'>
						{playerClass
							? [...CLASS_AVATARS[playerClass], ...extras.map((avatar) => avatar.id)].map((id) => {
									const avatar = avatarById(id);
									if (!avatar) return null;
									const selected = id === avatarId;
									return (
										<button
											key={id}
											type='button'
											role='radio'
											aria-checked={selected}
											className='hero-avatar'
											data-selected={selected}
											disabled={disabled}
											title={avatar.name}
											onClick={() => onAvatar(id)}
										>
											<AvatarArt id={id} scale={1.6} />
										</button>
									);
								})
							: [0, 1].map((slot) => (
									<span key={slot} className='hero-avatar' aria-hidden='true'>
										<AvatarArt id={SILHOUETTE_AVATAR} scale={1.6} locked />
									</span>
								))}
					</div>
				</div>
				<div className='hero-detail-body'>
					<div className='hero-detail-title'>
						<span className='hero-detail-name'>{info ? info.label : 'Choose your hero'}</span>
						{info && <span className='hero-detail-race'>{info.race}</span>}
					</div>
					<p className='hero-detail-play'>{info ? info.playstyle : 'Four heroes, four ways to play.'}</p>
					<p className='hero-detail-lore'>{info ? info.lore : 'Pick a class above to read its story, meet its two faces and see the bonuses it brings.'}</p>
					<div className='hero-bonuses'>
						<span className='hero-bonus-label'>Bonuses</span>
						<span className='hero-bonus-list'>
							{bonuses ? (
								<>
									{bonuses.combat.map((line) => (
										<span key={line} className='hero-bonus' data-kind='combat'>
											{line}
										</span>
									))}
									{bonuses.economy.map((line) => (
										<span key={line} className='hero-bonus' data-kind='economy'>
											{line}
										</span>
									))}
								</>
							) : (
								<span className='hero-bonus' data-kind='empty' aria-hidden='true'>
									?
								</span>
							)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default HeroCreator;
