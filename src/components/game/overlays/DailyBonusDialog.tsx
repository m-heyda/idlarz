import React, { useEffect, useRef, useState } from 'react';
import { dailyHiddenToday, setDailyHidden, shouldOpenDaily } from '@/lib/dailyPrompt';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import DailyBoard from '../DailyBoard';
import GameModal from '../GameModal';
import { Button, Checkbox } from '../../../../packages/design-system/src/components/primitives';

/**
 * The daily bonus window: a small window with the 7-day board and a Claim button that opens by itself once per start of the game, **after** the welcome-back window (it waits until that one is closed), and only when today's bonus can be claimed
 * and the player did not tick "Don't show again today". The server answers whether it can be claimed (`POST /api/gems` status); this asks after the start of the game is done (`ready`), because the server wants the absence claimed first.
 * The same board lives in the Gem shop, which stays the place to claim later.
 */
const DailyBonusDialog: React.FC<{ ready: boolean }> = ({ ready }) => {
	const offlineReportOpen = useUiStore((state) => state.offlineReport !== null);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const settle = () => useUiStore.getState().setDailySettled(true);
	const [open, setOpen] = useState(false);
	const [skipToday, setSkipToday] = useState(false);
	const asked = useRef(false);
	// the daily status is being read: the window may still open, so the game is not settled yet (a second run of the effect, as in React strict mode, must not settle it)
	const reading = useRef(false);
	// the window is on screen (the effect can run again, e.g. when the tab is taken over, while it is open)
	const shown = useRef(false);

	useEffect(() => {
		// the welcome-back window carries the daily bonus itself: no second pop-up for it after that window closes
		if (offlineReportOpen) {
			asked.current = true;
			return;
		}
		if (!shouldOpenDaily({ ready, offlineReportOpen, asked: asked.current, hiddenToday: dailyHiddenToday(), claimable: true })) {
			// asked once the start is done and nothing is in front of it, even when the player hid it today (it must not ask again later this session)
			if (ready && !offlineReportOpen) {
				asked.current = true;
				if (!reading.current && !shown.current) settle(); // nothing more in front of the game: the tutorial may start
			}
			return;
		}
		asked.current = true;
		reading.current = true;
		void useGemStore
			.getState()
			.refresh()
			.then(() => {
				reading.current = false;
				if (useGemStore.getState().info?.daily.available) {
					shown.current = true;
					setOpen(true);
				} else settle();
			});
	}, [ready, offlineReportOpen]);

	if (!open || offlineReportOpen) return null;

	const close = () => {
		if (skipToday) setDailyHidden(true);
		setOpen(false);
		shown.current = false;
		settle();
	};
	const claim = async () => {
		const reply = await useGemStore.getState().claimDaily();
		if (reply?.ok) {
			setOpen(false);
			shown.current = false;
			settle();
		}
	};

	return (
		<GameModal title='Daily bonus' size='md' onClose={close}>
			<div className='flex flex-col gap-4 px-1 pb-1' data-testid='daily-dialog'>
				<DailyBoard daily={info?.daily} busy={busy} onClaim={() => void claim()} />
				<div className='flex items-center justify-between gap-3'>
					<Checkbox checked={skipToday} onChange={setSkipToday} label="Don't show again today" />
					<Button onClick={close}>Later</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default DailyBonusDialog;
