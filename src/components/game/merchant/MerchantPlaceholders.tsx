import React, { useEffect } from 'react';
import { ComingSoon } from '../../../../packages/design-system/src/components/composites';
import { pixelIconSrc } from '@/config/pixelIcons';
import { newClaimId } from '@/lib/offlineClient';
import { requestGems } from '@/lib/rewardsClient';

/** The Quests tab: a coming-soon page. */
export const MerchantQuestsTab: React.FC = () => (
	<ComingSoon
		title='Quests'
		icon={pixelIconSrc('menu_achievements')}
		text='The merchant will post jobs here: bring goods, hunt a beast, earn gold and rare rewards.'
	/>
);

/** Opening the Gambling tab while it is still empty is a secret deed (IDL-305): the server is told once per page load, and it decides whether that counts. */
let gamblingSeen = false;

/** The Gambling tab: a coming-soon page that tells the server it was visited, for the deed (`visit` / `gambling_empty`; once per page load, tried again if the server did not take it). */
export const MerchantGamblingTab: React.FC = () => {
	useEffect(() => {
		if (gamblingSeen) return;
		gamblingSeen = true;
		void requestGems(newClaimId(), { action: 'visit', id: 'gambling_empty' }).then((reply) => {
			if (reply.status !== 'ok') gamblingSeen = false;
		});
	}, []);
	return (
		<ComingSoon title='Gambling' icon={pixelIconSrc('menu_gems_pouch')} text='Dice, wheels and a risky wager or two. The back room is still being built.' />
	);
};
