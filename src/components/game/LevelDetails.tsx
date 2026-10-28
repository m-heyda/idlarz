import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { BASE_XP_PER_LEVEL, XP_GROWTH_FACTOR } from '@/config/gameConfig';
import { LevelUpTimer } from './LevelUpTimer';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import CharacterPortrait from './CharacterPortrait';
import LevelOrb from './LevelOrb';
import { maxHp, maxMana } from '@/lib/combat';

type FlaskKind = 'hp' | 'mp';

// Potion flask: liquid level is driven by value/max, with rippling surface and rising bubbles
const Flask: React.FC<{ kind: FlaskKind; value: number; max: number }> = ({
	kind,
	value,
	max,
}) => {
	const fill = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
	const label = kind === 'hp' ? 'HP' : 'MP';
	return (
		<div
			className='hero-flask'
			data-side={kind === 'hp' ? 'left' : 'right'}
			title={`${label}: ${formatNumber(value)} / ${formatNumber(max)}`}>
			<div
				className={`px-flask px-flask-${kind}`}
				style={{ '--s': 2 } as React.CSSProperties}>
				<div className='px-flask-liquid-wrap'>
					<div className='px-flask-liquid' style={{ '--p': fill } as React.CSSProperties} />
				</div>
				<div className='px-flask-glass' />
			</div>
			<div className='hero-flask-val'>{formatNumber(value)}</div>
		</div>
	);
};

const xpNumbers = (level: { level: number; progress: number }) => {
	const next = Math.floor(BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, level.level - 1));
	return { next, current: Math.floor(next * level.progress), pct: Math.floor(level.progress * 100) };
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
	const { resources, level, resourceRates, characterStats, equipment, playerHp, playerMp } = useGameStore();
	const { next, current, pct } = xpNumbers(level);
	const hpMax = maxHp(characterStats, equipment);
	const mpMax = maxMana(characterStats, equipment);
	return (
		<div className='eq-level-wrap'>
		<div className='eq-level'>
			<div className='eq-level-orb' title={`Level ${level.level}`}>
				<LevelOrb scale={2} level={level.level} />
			</div>
			<div className='group relative flex-1'>
				<div className='hero-xp eq-xp' style={{ '--pct': level.progress * 100 } as React.CSSProperties}>
					<div className='hero-xp-fill' />
					<div className='hero-xp-text'>
						{pct}% · {formatNumber(current)} / {formatNumber(next)}
					</div>
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
 * The character "scene": the hero standing in a torch-lit stone alcove, HP/MP flasks flanking him
 * and a stony XP bar along the floor with the level on a gem. Shared by the Character and Statistics windows.
 */
const LevelDetails: React.FC = () => {
	const { resources, level, resourceRates, characterStats, playerClass, playerHp, playerMp, equipment, playerName } = useGameStore();
	const hpMax = maxHp(characterStats, equipment);
	const mpMax = maxMana(characterStats, equipment);
	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];

	const xpForNextLevel = Math.floor(
		BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, level.level - 1)
	);
	const currentXp = Math.floor(xpForNextLevel * level.progress);
	const pct = Math.floor(level.progress * 100);

	return (
		<div className='hero-hud'>
			<div className='hero-torch' style={{ left: 26 }} />
			<div className='hero-torch' style={{ left: 240 }} />

			<div className='hero-nameplate'>
				<span className='px-name'>{playerName}</span>
				<span className='hero-class'>
					{info.race} {info.label}
				</span>
			</div>

			<div className='hero-figure'>
				<CharacterPortrait scale={2} />
			</div>

			<Flask kind='hp' value={Math.floor(playerHp)} max={hpMax} />
			<Flask kind='mp' value={playerMp} max={mpMax} />

			<div className='group'>
				<div className='hero-xp' style={{ '--pct': level.progress * 100 } as React.CSSProperties}>
					<div className='hero-xp-fill' />
					<div className='hero-xp-text'>
						{pct}% · {formatNumber(currentXp)} / {formatNumber(xpForNextLevel)}
					</div>
				</div>
				<div className='absolute left-1/2 top-full -translate-x-1/2 mt-2 w-max z-[60] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150'>
					<div className='px-tooltip'>
						<LevelUpTimer resourceRates={resourceRates} resources={resources} level={level} />
					</div>
				</div>
			</div>

			<div className='hero-orb' title={`Level ${level.level}`}>
				<LevelOrb scale={2} level={level.level} />
			</div>
		</div>
	);
};

export default LevelDetails;
