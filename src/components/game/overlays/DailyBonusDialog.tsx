import React, { useEffect, useRef, useState } from 'react';
import { dailyHiddenToday, setDailyHidden, shouldOpenDaily } from '@/lib/dailyPrompt';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import DailyBoard from '../DailyBoard';
import GemIcon from '../GemIcon';
import GameModal from '../GameModal';
import { Button } from '../../../../packages/design-system/src/components/primitives';

/**
 * The daily bonus window: a small window with the 7-day board and a Claim button that opens by itself once per start of the game, **after** the welcome-back window (it waits until that one is closed), and only when today's bonus can be claimed
 * and the player did not tick "Don't show again today". The server answers whether it can be claimed (`POST /api/gems` status); this asks after the start of the game is done (`ready`), because the server wants the absence claimed first.
 * The same board lives in the Gem shop, which stays the place to claim later.
 */
const DailyBonusDialog: React.FC<{ ready: boolean }> = ({ ready }) => {
	const offlineReportOpen = useUiStore((state) => state.offlineReport !== null);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const [open, setOpen] = useState(false);
	const [skipToday, setSkipToday] = useState(false);
	const asked = useRef(false);

	useEffect(() => {
		if (!shouldOpenDaily({ ready, offlineReportOpen, asked: asked.current, hiddenToday: dailyHiddenToday(), claimable: true })) {
			// asked once the start is done and nothing is in front of it, even when the player hid it today (it must not ask again later this session)
			if (ready && !offlineReportOpen) asked.current = true;
			return;
		}
		asked.current = true;
		void useGemStore
			.getState()
			.refresh()
			.then(() => {
				if (useGemStore.getState().info?.daily.available) setOpen(true);
			});
	}, [ready, offlineReportOpen]);

	if (!open || offlineReportOpen) return null;

	const close = () => {
		if (skipToday) setDailyHidden(true);
		setOpen(false);
	};
	const claim = async () => {
		const reply = await useGemStore.getState().claimDaily();
		if (reply?.ok) setOpen(false);
	};

	return (
		<GameModal title='Daily bonus' icon={<GemIcon />} size='md' onClose={close}>
			<div className='flex flex-col gap-4 px-1 pb-1' data-testid='daily-dialog'>
				<DailyBoard daily={info?.daily} busy={busy} onClaim={() => void claim()} />
				<div className='flex items-center justify-between gap-3'>
					<label className='flex items-center gap-2 text-sm text-[#a89878] cursor-pointer select-none'>
						<input type='checkbox' checked={skipToday} onChange={(event) => setSkipToday(event.target.checked)} />
						Don&apos;t show again today
					</label>
					<Button onClick={close}>Later</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default DailyBonusDialog;
