import React, { useEffect, useState } from 'react';
import { useRewardPendingStore } from '@/stores/rewardPendingStore';
import PixelIcon from '../PixelIcon';
import '@/styles/RewardPendingChest.css';

/** A reply that comes back faster than this never shows the chest (no flash for a fast server) */
const SHOW_DELAY_MS = 250;
const FADE_MS = 300;

type Stage = 'off' | 'on' | 'out';

/**
 * A small chest that bobs in the middle of the screen while a reward is on its way from the server: the quiet little cousin of the
 * level-up celebration, with no shade and no clicks. It fades away as the loot shows up.
 */
const RewardPendingChest: React.FC = () => {
	const pending = useRewardPendingStore((state) => state.count > 0);
	const [stage, setStage] = useState<Stage>('off');

	useEffect(() => {
		if (pending) {
			const timer = setTimeout(() => setStage('on'), SHOW_DELAY_MS);
			return () => clearTimeout(timer);
		}
		setStage((current) => (current === 'on' ? 'out' : 'off'));
	}, [pending]);

	useEffect(() => {
		if (stage !== 'out') return;
		const timer = setTimeout(() => setStage('off'), FADE_MS);
		return () => clearTimeout(timer);
	}, [stage]);

	if (stage === 'off') return null;
	return (
		<div className='rp-root' data-leaving={stage === 'out'} aria-hidden>
			<span className='rp-halo' />
			<PixelIcon name='bonus_chest' scale={2} className='rp-chest' />
		</div>
	);
};

export default RewardPendingChest;
