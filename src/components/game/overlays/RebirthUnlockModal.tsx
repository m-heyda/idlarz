import React, { useState } from 'react';
import { biomeArtUrl } from '@/config/biomeArt';
import { biomeColor } from '@/config/biomePalette';
import { formatHeaderAmount, formatInt, formatNumber, formatTime, tidy } from '@/utils/formatters';
import type { RebirthRunSummary, RebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import PixelModal from '../PixelModal';
import ResourceIcon from '../ResourceIcon';
import EmberIcon from '../EmberIcon';

const pct = (fraction: number) => `${tidy((fraction * 100).toFixed(fraction >= 1 ? 0 : 1))}%`;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
	<div className='flex items-baseline justify-between gap-3 border-b px-rule py-1 last:border-b-0'>
		<span className='text-[#a89878]'>{label}</span>
		<span className='text-[#ecdcb4] text-right'>{children}</span>
	</div>
);

/**
 * The result screen shown right after a rebirth: the Embers it paid and the income bonus they bring, what it unlocked (a new land with its output, and the monsters that
 * come with it; their names stay hidden until the player meets them), and a "run stats" toggle with the numbers of the run that just ended. `intro` is null when this rebirth
 * unlocked nothing new (the sixth and later); the Embers and the stats are always there.
 */
const RebirthUnlockModal: React.FC<{ run: RebirthRunSummary; intro: RebirthUnlockIntro | null; onClose: () => void }> = ({ run, intro, onClose }) => {
	const [nerds, setNerds] = useState(false);
	const art = intro ? biomeArtUrl(intro.biome) : undefined;
	const monsterCount = intro ? intro.monsters.normal + intro.monsters.boss : 0;
	return (
		<PixelModal title='Rebirth complete' size='sm' onClose={onClose}>
			<div className='px-card mb-3 text-sm text-center'>
				<div className='text-xs uppercase tracking-widest text-[#a89878] mb-1'>Rebirth {run.rebirths}</div>
				<div className='flex items-center justify-center gap-2 text-2xl font-bold text-green-300' data-testid='rebirth-embers'>
					<EmberIcon />+{formatHeaderAmount(run.embersGained)} Embers
				</div>
				<div className='mt-2 text-[#d8c8a0]' data-testid='rebirth-income'>
					Income bonus <b className='text-green-400'>+{pct(run.incomeBonusBefore)}</b> to <b className='text-green-400'>+{pct(run.incomeBonusAfter)}</b>{' '}
					<span className='text-[#a89878]'>(+{pct(run.incomeBonusAfter - run.incomeBonusBefore)})</span>
				</div>
				<div className='text-xs text-[#a89878] mt-1'>{formatHeaderAmount(run.embersTotal)} Embers to spend in the Ember shop</div>
			</div>

			{intro && (
				<div className='px-card mb-3 text-sm text-center'>
					<div className='px-h'>Unlocked</div>
					{art && (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={art} alt={intro.label} width={136} height={136} className='pixelated mx-auto mb-2' style={{ imageRendering: 'pixelated' }} />
					)}
					<div
						className='flex items-center justify-center gap-2 px-2 py-1 mx-auto w-fit border-2 border-[#8a6a3a] bg-[#1a140c]'
						data-testid='rebirth-biome-header'
					>
						<span
							aria-hidden='true'
							className='inline-block h-5 w-5 border-2 border-black/70 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.18)]'
							style={{ background: biomeColor(intro.biome) }}
						/>
						<span className='text-base font-bold uppercase tracking-wider text-[#f0d27a]'>{intro.label}</span>
					</div>
					<p className='text-[#d8c8a0] mt-2 mb-2'>
						Your new map can now grow {intro.label} tiles. Each makes about <b>x{intro.multiplier}</b> the output of {intro.measuredAgainst}:
					</p>
					<div className='flex flex-wrap justify-center gap-x-4 gap-y-1 text-[#ecdcb4]'>
						{intro.outputs.map((o) => (
							<span key={o.resource} className='inline-flex items-center gap-1 whitespace-nowrap'>
								<ResourceIcon resource={o.resource} />+{formatNumber(o.perSecond)}/s
							</span>
						))}
					</div>
					{monsterCount > 0 && (
						<p className='text-[#ecdcb4] mt-3' data-testid='rebirth-monsters'>
							<b>{monsterCount}</b> new monster{monsterCount === 1 ? '' : 's'}
							{intro.monsters.boss > 0 ? ` (${intro.monsters.boss} boss)` : ''} now roam this land. Their names stay hidden until you meet them.
						</p>
					)}
					<p className='text-xs text-[#a89878] mt-3'>{intro.note}</p>
				</div>
			)}

			<div className='px-card mb-3 text-sm'>
				<button
					type='button'
					className='w-full flex items-center justify-between text-left text-[#f0d27a]'
					aria-expanded={nerds}
					onClick={() => setNerds((on) => !on)}
				>
					<span>Run stats (for nerds)</span>
					<span aria-hidden='true'>{nerds ? '-' : '+'}</span>
				</button>
				{nerds && (
					<div className='mt-2' data-testid='rebirth-nerd-stats'>
						<Row label='Tiles owned'>{formatInt(run.ownedTiles)}</Row>
						<Row label='Castle level'>{run.castleLevel}</Row>
						<Row label='Hero level'>{run.level}</Row>
						<Row label='Embers earned in all'>{formatHeaderAmount(run.embersEverEarned)}</Row>
						<Row label='Time played'>{formatTime(run.playSeconds)}</Row>
						{run.kills !== null && <Row label='Monsters slain (all runs)'>{formatInt(run.kills)}</Row>}
						<Row label='Best production rates'>
							<span className='inline-flex flex-wrap justify-end gap-x-3 gap-y-1'>
								{run.topRates.map((r) => (
									<span key={r.resource} className='inline-flex items-center gap-1 whitespace-nowrap'>
										<ResourceIcon resource={r.resource} />
										{formatNumber(r.perSecond)}/s
									</span>
								))}
							</span>
						</Row>
						<Row label='Next rebirth needs'>{formatInt(run.nextTilesNeeded)} tiles</Row>
					</div>
				)}
			</div>

			<div className='flex justify-center'>
				<button className='px-btn px-btn-gold' onClick={onClose}>
					Continue
				</button>
			</div>
		</PixelModal>
	);
};

export default RebirthUnlockModal;
