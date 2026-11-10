import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { MAX_LEVEL } from '@/config/character';
import { xpToNextLevel } from '@/utils/game/character';
import { useUiStore } from '@/stores/uiStore';
import { LevelUpTimer } from './LevelUpTimer';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import CharacterPortrait from './CharacterPortrait';
import LevelOrb from './LevelOrb';
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

/** The compact version: the level orb and the XP bar in one row, no hero scene (the Equipment tab). */
export const LevelBar: React.FC = () => {
	const { resources, level, resourceRates, characterStats, equipment, playerHp, playerMp, playerClass } = useGameStore();
	const hpMax = maxHp(characterStats, equipment);
	const mpMax = maxMana(characterStats, equipment, playerClass);
	return (
		<div className='eq-level-wrap'>
			<div className='eq-level'>
				<div className='eq-level-orb' title={`Level ${level.level}`}>
					<LevelOrb scale={2} level={level.level} />
				</div>
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
 * The hero card of the Character and Statistics windows: the avatar (a click opens the avatar dialog, there is no extra button), the name and class, then the level, the XP bar and the
 * HP and MP bars (`LevelBar`). It replaced the torch-lit alcove scene with its potion flasks (a first simplification, the card is reworked later).
 */
const LevelDetails: React.FC = () => {
	const playerClass = useGameStore((state) => state.playerClass);
	const playerName = useGameStore((state) => state.playerName);
	const openAvatarDialog = useUiStore((state) => state.openAvatarDialog);
	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];

	return (
		<div className='hero-card'>
			<div className='hero-card-top'>
				<button type='button' className='hero-card-avatar' onClick={openAvatarDialog} title='Change avatar' aria-label='Change avatar'>
					<CharacterPortrait variant='bust' scale={2} />
				</button>
				<div className='hero-card-id'>
					<span className='px-name hero-card-name'>{playerName}</span>
					<span className='hero-class'>
						{info.race} {info.label}
					</span>
				</div>
			</div>
			<LevelBar />
		</div>
	);
};

export default LevelDetails;
