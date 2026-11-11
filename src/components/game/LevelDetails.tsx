import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { MAX_LEVEL } from '@/config/character';
import { xpToNextLevel } from '@/utils/game/character';
import { useUiStore } from '@/stores/uiStore';
import { LevelUpTimer } from './LevelUpTimer';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import CharacterPortrait from './CharacterPortrait';
import AchievementBadge from './AchievementBadge';
import { useBadgeChoice } from './BadgeDialog';
import { shownBadge, shownTitle } from '@/catalog/badges';
import LevelOrb from './LevelOrb';
import LevelBadge from './LevelBadge';
import { maxHp, maxMana } from '@/lib/combat';

type FlaskKind = 'hp' | 'mp';

/** The text of an XP bar: "42% · 1.2K / 2.9K", or "MAX" at the maximum level (the bar is full). */
const xpLabel = (level: { level: number; progress: number }) => {
	if (level.level >= MAX_LEVEL) return 'MAX';
	const next = xpToNextLevel(level.level);
	return `${Math.floor(level.progress * 100)}% · ${formatNumber(Math.floor(next * level.progress))} / ${formatNumber(next)}`;
};

/** A flat HP or MP bar with its numbers: half of the XP bar's width each (see .eq-vitals). */
const VitalBar: React.FC<{ kind: FlaskKind; value: number; max: number }> = ({ kind, value, max }) => (
	<div className='eq-vital' data-kind={kind} title={`${kind === 'hp' ? 'HP' : 'MP'}: ${formatNumber(value)} / ${formatNumber(max)}`}>
		<div className='eq-vital-fill' style={{ width: `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%` }} />
		<span className='eq-vital-text'>
			{kind === 'hp' ? 'HP' : 'MP'} {formatCompact(value)} / {formatCompact(max)}
		</span>
	</div>
);

/** The compact version: the level orb and the XP bar in one row, no hero scene (the Equipment tab). With `orb={false}` the orb is left out (the hero card shows the level as a square badge beside the XP bar instead) and the XP, HP and MP bars use the full width. */
export const LevelBar: React.FC<{ orb?: boolean }> = ({ orb = true }) => {
	const { resources, level, resourceRates, characterStats, equipment, playerHp, playerMp, playerClass } = useGameStore();
	const hpMax = maxHp(characterStats, equipment);
	const mpMax = maxMana(characterStats, equipment, playerClass);
	return (
		<div className={`eq-level-wrap${orb ? '' : ' eq-level-wrap-flat'}`}>
			<div className='eq-level'>
				{!orb && <LevelBadge level={level.level} className='level-badge-bar' />}
				{orb && (
					<div className='eq-level-orb' title={`Level ${level.level}`}>
						<LevelOrb scale={2} level={level.level} />
					</div>
				)}
				<div className='group relative flex-1'>
					<div className='hero-xp eq-xp' style={{ '--pct': level.progress * 100 } as React.CSSProperties}>
						<div className='hero-xp-fill' />
						<div className='hero-xp-text'>{xpLabel(level)}</div>
					</div>
					<div className='absolute left-1/2 top-full -translate-x-1/2 mt-2 w-max z-[60] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150'>
						<div className='px-tooltip'>
							<LevelUpTimer resourceRates={resourceRates} resources={resources} level={level} />
						</div>
					</div>
				</div>
			</div>
			<div className='eq-vitals'>
				<VitalBar kind='hp' value={Math.floor(playerHp)} max={hpMax} />
				<VitalBar kind='mp' value={Math.floor(playerMp)} max={mpMax} />
			</div>
		</div>
	);
};

/**
 * The hero card of the Character and Statistics windows: the avatar (a click opens the avatar dialog, there is no extra button), the name and badge (a click opens the badge and title picker, which also hides the badge; later customisation such as a name glow goes there too) and the class, then the level, the XP bar and the
 * HP and MP bars (`LevelBar`). It replaced the torch-lit alcove scene with its potion flasks (a first simplification, the card is reworked later).
 */
const LevelDetails: React.FC = () => {
	const playerClass = useGameStore((state) => state.playerClass);
	const playerName = useGameStore((state) => state.playerName);
	const openAvatarDialog = useUiStore((state) => state.openAvatarDialog);
	const openBadgeDialog = useUiStore((state) => state.openBadgeDialog);
	const choice = useUiStore((state) => state.badge);
	useBadgeChoice();
	const badge = shownBadge(choice.badgeId, choice.earned);
	const title = shownTitle(choice.titleId, choice.earned);
	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];

	return (
		<div className='hero-card'>
			<div className='hero-card-top'>
				<button type='button' className='hero-card-avatar' onClick={openAvatarDialog} title='Change avatar' aria-label='Change avatar'>
					<CharacterPortrait variant='bust' scale={2} />
				</button>
				<div className='hero-card-id'>
					<button
						type='button'
						className='px-name hero-card-name hero-card-name-btn'
						onClick={openBadgeDialog}
						title='Change badge and title'
						aria-label='Change badge and title'
					>
						{playerName}
						{badge && <AchievementBadge achievement={badge} size={22} />}
					</button>
					{title && <span className='hero-class'>{title}</span>}
					<span className='hero-class'>
						{info.race} {info.label}
					</span>
				</div>
			</div>
			<LevelBar orb={false} />
		</div>
	);
};

export default LevelDetails;
