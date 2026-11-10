'use client';

import React from 'react';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { AVATARS, CLASS_AVATARS, avatarById } from '@/catalog/avatars';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { describeClassPassives } from '@/lib/classPassives';
import PixelIcon from '@/components/game/PixelIcon';
import AvatarArt from '@/components/game/AvatarArt';
import '@/styles/Heroes.css';

export interface HeroCreatorProps {
	name: string;
	onName: (name: string) => void;
	/** null: nothing chosen yet (the detail panel asks for a pick) */
	playerClass: PlayerClassId | null;
	onClass: (id: PlayerClassId) => void;
	/** The chosen avatar id; the class's default while the player has not picked one */
	avatarId: string | null;
	onAvatar: (id: string) => void;
	/** Ids of avatars the account has earned beyond the starters (shown as extra choices); a brand-new account has none */
	earned?: readonly string[];
	disabled?: boolean;
}

/**
 * The hero creation block shared by sign-up, "Finish your hero" and "A new chapter": the name, four class tabs and, for the chosen class, a detail card with the full figure,
 * its blurb, its two bonuses (the real `CLASS_PASSIVES`, written out by `describeClassPassives`) and the two avatars the class owns. Earned avatars (when the account has any)
 * show as extra choices. The server decides again on every save (`checkCreationAvatar`).
 */
const HeroCreator: React.FC<HeroCreatorProps> = ({ name, onName, playerClass, onClass, avatarId, onAvatar, earned = [], disabled = false }) => {
	const info = playerClass ? PLAYER_CLASSES[playerClass] : null;
	const bonuses = playerClass ? describeClassPassives(playerClass) : null;
	const extras = AVATARS.filter((avatar) => avatar.kind === 'unlock' && earned.includes(avatar.id));
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
							<AvatarArt id={null} playerClass={id} scale={1} />
							<span className='hero-tab-text'>
								<span className='hero-tab-name'>{tab.label}</span>
								<span className='hero-tab-race'>{tab.race}</span>
							</span>
						</button>
					);
				})}
			</div>

			{info && bonuses && playerClass ? (
				<div className='hero-detail' style={{ '--accent': info.accent } as React.CSSProperties} aria-live='polite'>
					<div className='hero-detail-stage'>
						<PixelIcon name={info.full} scale={2.4} alt={`${info.race} ${info.label}`} />
					</div>
					<div className='hero-detail-body'>
						<div className='hero-detail-title'>
							<span className='hero-detail-name'>{info.label}</span>
							<span className='hero-detail-race'>{info.race}</span>
						</div>
						<p className='hero-detail-blurb'>{info.blurb}</p>
						<div className='hero-bonuses'>
							<div className='hero-bonus-row'>
								<span className='hero-bonus-label'>Combat</span>
								<span className='hero-bonus-list'>
									{bonuses.combat.map((line) => (
										<span key={line} className='hero-bonus' data-kind='combat'>
											{line}
										</span>
									))}
								</span>
							</div>
							<div className='hero-bonus-row'>
								<span className='hero-bonus-label'>Economy</span>
								<span className='hero-bonus-list'>
									{bonuses.economy.map((line) => (
										<span key={line} className='hero-bonus' data-kind='economy'>
											{line}
										</span>
									))}
								</span>
							</div>
						</div>
						<div className='hero-avatars' role='radiogroup' aria-label='Avatar'>
							<span className='hero-bonus-label'>Avatar</span>
							{[...CLASS_AVATARS[playerClass], ...extras.map((avatar) => avatar.id)].map((id) => {
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
										<AvatarArt id={id} scale={1.5} />
										<span className='hero-avatar-name'>{avatar.name}</span>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			) : (
				<p className='hero-detail-empty'>Pick a hero to see its bonuses and avatars.</p>
			)}
		</div>
	);
};

export default HeroCreator;
