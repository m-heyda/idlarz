import React, { useState } from 'react';
import type { ItemInstance } from '@/types/game';
import { refKey, type KeepRef } from '@/lib/rebirthKeep';
import { formatHeaderAmount } from '@/utils/formatters';
import { pixelIconSrc } from '@/config/pixelIcons';
import { notify } from '@/lib/notices';
import type { RebirthChoice } from '@/lib/serverRebirth';
import GameModal from '../GameModal';
import { Button, HoverTip, SectionLabel, Slot } from '../../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../../packages/design-system/src/components/tooltips';
import { toRarity } from '../../../../packages/design-system/src/logic';
import { resolveItem } from '@/lib/itemInstance';
import { itemIconName } from '../itemUi';
import { GameItemTip } from '../hero/GameItemTip';
import '@/styles/Rebirth.css';

/** A piece the player could carry over, with the place it is in. */
export interface KeepCandidate {
	ref: KeepRef;
	item: ItemInstance;
}

const look = (item: ItemInstance) => {
	const resolved = resolveItem(item);
	return resolved ? { name: resolved.name, icon: pixelIconSrc(itemIconName(resolved.def)), rarity: toRarity(String(resolved.instance.rarity)) } : null;
};

/** The pieces the picker lists: a Slot with the hover card; a click chooses it. */
const PickCell: React.FC<{ candidate: KeepCandidate; onPick: () => void }> = ({ candidate, onPick }) => {
	const l = look(candidate.item);
	if (!l) return null;
	return (
		<HoverTip interactive closeDelayMs={100} tip={<GameItemTip item={candidate.item} />}>
			<Slot icon={l.icon} rarity={l.rarity} equipped={candidate.ref.from === 'equip'} aria-label={l.name} onClick={onPick} />
		</HoverTip>
	);
};

/** The minibag: every epic or legendary piece the player owns (in the bag or worn) that is not chosen yet. A click chooses it and closes the list. */
export const KeepPicker: React.FC<{ candidates: KeepCandidate[]; onPick: (candidate: KeepCandidate) => void; onClose: () => void }> = ({
	candidates,
	onPick,
	onClose,
}) => (
	<GameModal title='Choose a piece to keep' size='sm' onClose={onClose}>
		<div className='rb-stack' data-testid='keep-picker'>
			<p className='rb-note'>Click a piece to carry it into your next run. Worn pieces have a gold corner.</p>
			{candidates.length === 0 ? (
				<p className='rb-note'>Every epic and legendary piece you own is already chosen.</p>
			) : (
				<div className='rb-pick-grid'>
					{candidates.map((c) => (
						<PickCell key={refKey(c.ref)} candidate={c} onPick={() => onPick(c)} />
					))}
				</div>
			)}
		</div>
	</GameModal>
);

/** What a rebirth costs the player and what it leaves them: the two lists the confirm window shows. */
const LOSE = [
	'Your map and every tile you bought',
	'All resources and the castle level',
	'Farm, animals, buildings and chests',
	'Bag and worn gear, except what you keep on the next screen',
	'Merchant upgrades (Pack Rat stays), buffs and loot pity',
];
const KEEP = [
	'Name, hero, level and XP, and your paragon level',
	'All Embers and Ember shop upgrades',
	'Gems and Idol levels',
	'Pack Rat and Deep Pockets bag size, the auto-sell setting',
];

export interface RebirthConfirmProps {
	/** Embers this rebirth pays, and the income it adds (as a ready text such as "+12%") */
	gain: number;
	incomeText: string;
	/** The land this rebirth unlocks, when it does */
	unlockLabel?: string;
	/** How many pieces this rebirth may carry over, and every piece the player owns that could be */
	slots: number;
	candidates: KeepCandidate[];
	asking: boolean;
	/** Paragon points the player has spent (the second tick box only shows when there are some) */
	paragonPoints?: number;
	/** The extra attribute points this rebirth gives (shown next to the first tick box) */
	extraPoints?: number;
	onCancel: () => void;
	onConfirm: (keep: KeepCandidate[], choice: RebirthChoice) => void;
}

/**
 * The rebirth confirmation, in two steps. Step 1 lists, as bullets, what is lost and what is kept. Step 2 ("Select gear to keep") shows one slot for each piece this rebirth lets the player
 * carry over (`keepSlots`): an empty slot is a [+] that opens the minibag of owned epic and legendary pieces, a filled slot shows the piece (click to put it back). Rebirth or Keep playing ends it. Leaving every
 * slot empty while owning keepable pieces asks once more ("are you sure?"). With none owned, step 2 is skipped.
 */
const RebirthConfirmModal: React.FC<RebirthConfirmProps> = ({
	gain,
	incomeText,
	unlockLabel,
	slots,
	candidates,
	asking,
	paragonPoints = 0,
	extraPoints = 20,
	onCancel,
	onConfirm,
}) => {
	// the two free respecs of a rebirth: the attribute points go back by default (as they always did); unticked, they stay and only the extra points are added. The paragon points stay by default; ticked, they go back for free.
	const [takeAttrsBack, setTakeAttrsBack] = useState(true);
	const [takeParagonBack, setTakeParagonBack] = useState(false);
	const choice: RebirthChoice = { keepAttrs: !takeAttrsBack, resetParagon: takeParagonBack && paragonPoints > 0 };
	const [step, setStep] = useState<'confirm' | 'keep'>('confirm');
	const [chosen, setChosen] = useState<KeepCandidate[]>([]);
	const [picking, setPicking] = useState(false);
	const [sure, setSure] = useState(false);
	const canKeep = slots > 0 && candidates.length > 0;
	const free = candidates.filter((c) => !chosen.some((x) => refKey(x.ref) === refKey(c.ref)));

	if (step === 'confirm')
		return (
			<GameModal title='Rebirth now?' size='md' width={760} onClose={onCancel}>
				<div className='rb-stack' data-testid='rebirth-confirm'>
					<p className='rb-text'>
						You gain <b className='text-green-300'>{formatHeaderAmount(gain)}</b> Embers ({incomeText} income for ever).
					</p>
					<div className='rb-lists'>
						<div className='rb-card'>
							<SectionLabel>You lose</SectionLabel>
							<ul className='rb-bullets' data-kind='lose'>
								{LOSE.map((line) => (
									<li key={line}>{line}</li>
								))}
							</ul>
						</div>
						<div className='rb-card'>
							<SectionLabel>You keep</SectionLabel>
							<ul className='rb-bullets' data-kind='keep'>
								{KEEP.map((line) => (
									<li key={line}>{line}</li>
								))}
								<li>
									Up to <b>{slots}</b> epic or legendary {slots === 1 ? 'piece' : 'pieces'} of your choice
								</li>
							</ul>
						</div>
					</div>
					<div className='rb-card' data-testid='rebirth-respec'>
						<SectionLabel>Free respec</SectionLabel>
						<label className='rb-check'>
							<input type='checkbox' checked={takeAttrsBack} onChange={(e) => setTakeAttrsBack(e.target.checked)} data-testid='respec-attrs' />
							<span>Take back my attribute points to spend again (free respec)</span>
						</label>
						<p className='rb-note'>
							{takeAttrsBack
								? 'Every attribute point goes back and you spend them all again.'
								: `Your attributes stay as they are and you only get the ${extraPoints} extra points to spend.`}
						</p>
						{paragonPoints > 0 && (
							<label className='rb-check'>
								<input type='checkbox' checked={takeParagonBack} onChange={(e) => setTakeParagonBack(e.target.checked)} data-testid='respec-paragon' />
								<span>Take back my {paragonPoints} paragon points to spend again (free respec)</span>
							</label>
						)}
					</div>
					{unlockLabel && (
						<p className='rb-text' style={{ color: '#f0d27a' }}>
							This rebirth unlocks a new land: <b>{unlockLabel}</b>.
						</p>
					)}
					<div className='flex justify-between'>
						<Button onClick={onCancel}>Not yet</Button>
						{canKeep ? (
							<Button tone='gold' onClick={() => setStep('keep')}>
								Continue
							</Button>
						) : (
							<Button tone='danger' onClick={() => onConfirm([], choice)} disabled={asking}>
								{asking ? 'Asking the server...' : 'Rebirth'}
							</Button>
						)}
					</div>
				</div>
			</GameModal>
		);

	const rebirth = () => {
		if (chosen.length === 0 && candidates.length > 0 && !sure) {
			setSure(true);
			return;
		}
		onConfirm(chosen, choice);
	};

	return (
		<>
			<GameModal title='Select gear to keep' size='md' width={760} onClose={onCancel}>
				<div className='rb-stack' data-testid='rebirth-keep'>
					<p className='rb-text'>
						Carry up to <b>{slots}</b> epic or legendary {slots === 1 ? 'piece' : 'pieces'} into your next run. They arrive in your bag. You own{' '}
						<b>{candidates.length}</b>.
					</p>
					<div className='rb-card'>
						<SectionLabel>
							Kept pieces ({chosen.length} of {slots})
						</SectionLabel>
						<div className='rb-keep-grid'>
							{Array.from({ length: slots }, (_, i) => {
								const c = chosen[i];
								const l = c ? look(c.item) : null;
								if (c && l)
									return (
										<HoverTip key={refKey(c.ref)} interactive closeDelayMs={100} tip={<GameItemTip item={c.item} />}>
											<Slot
												icon={l.icon}
												rarity={l.rarity}
												equipped={c.ref.from === 'equip'}
												aria-label={`${l.name}, click to put back`}
												onClick={() => {
													setChosen(chosen.filter((x) => x !== c));
													setSure(false);
												}}
											/>
										</HoverTip>
									);
								// the first empty slot opens the minibag; the rest wait for their turn
								const next = i === chosen.length;
								return (
									<HoverTip
										key={`free-${i}`}
										tip={
											<HintTooltip title='Keep a piece' text={next ? 'Choose a piece to carry into your next run' : 'Fill the slot before this one first'} />
										}
									>
										<button
											type='button'
											className='ds-slot ds-slot-add'
											aria-label='Add a piece to keep'
											data-testid='keep-add'
											style={next ? undefined : { opacity: 0.45 }}
											onClick={() => {
												if (!next) return notify('Fill the earlier slot first', 'error');
												if (free.length === 0) return notify('You have no more epic or legendary pieces to keep', 'error');
												setPicking(true);
											}}
										>
											+
										</button>
									</HoverTip>
								);
							})}
						</div>
					</div>
					{sure && (
						<div className='rb-card rb-warn' data-testid='keep-none-warning'>
							<p className='rb-warn-text'>
								You own <b>{candidates.length}</b> epic or legendary {candidates.length === 1 ? 'piece' : 'pieces'}. Are you sure you do not want to keep any of
								them? Everything in your bag and worn will be lost.
							</p>
						</div>
					)}
					<div className='flex justify-between'>
						<Button onClick={onCancel}>Keep playing</Button>
						<Button tone='danger' onClick={rebirth} disabled={asking}>
							{asking ? 'Asking the server...' : sure ? 'Rebirth without keeping' : 'Rebirth'}
						</Button>
					</div>
				</div>
			</GameModal>
			{picking && (
				<KeepPicker
					candidates={free}
					onClose={() => setPicking(false)}
					onPick={(c) => {
						setChosen([...chosen, c]);
						setSure(false);
						setPicking(false);
					}}
				/>
			)}
		</>
	);
};

export default RebirthConfirmModal;
