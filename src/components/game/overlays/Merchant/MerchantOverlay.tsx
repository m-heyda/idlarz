import React, { useEffect } from 'react';
import { newClaimId } from '@/lib/offlineClient';
import { requestGems } from '@/lib/rewardsClient';
import { useUiStore } from '@/stores/uiStore';

/** Opening the Gambling tab while it is still empty is a secret deed (IDL-305): the server is told once per page load, and it decides whether that counts. */
let gamblingSeen = false;
const GamblingPlaceholder: React.FC = () => {
	useEffect(() => {
		if (gamblingSeen) return;
		gamblingSeen = true;
		void requestGems(newClaimId(), { action: 'visit', id: 'gambling_empty' }).then((reply) => {
			if (reply.status !== 'ok') gamblingSeen = false;
		});
	}, []);
	return <PlaceholderTabContent title='Gambling' emoji='🎲' description='Coming soon! Test your luck with various games of chance. Win big or lose it all!' />;
};

interface PlaceholderTabContentProps {
	title: string;
	emoji: string;
	description: string;
}

const PlaceholderTabContent: React.FC<PlaceholderTabContentProps> = ({ title, emoji, description }) => (
	<>
		<h2 className='px-h text-center'>{title}</h2>
		<div className='flex flex-col items-center justify-center h-[60vh]'>
			<div className='text-6xl mb-6'>{emoji}</div>
			<p className='text-[#a89878] text-center'>{description}</p>
		</div>
	</>
);

/**
 * The Quests and Gambling tabs of the Merchant window: coming-soon pages in their own look while they are rebuilt (Resources, Goods and Upgrades are the new tabs next to them).
 */
const MerchantOverlay: React.FC = () => {
	const activeTab = useUiStore((state) => state.merchantTab);
	return (
		<div className='px-panel flex flex-col'>
			{activeTab === 'quests' ? (
				<PlaceholderTabContent
					title='Quests'
					emoji='📜'
					description='Coming soon! Take on special assignments from the merchant for valuable rewards and unique items.'
				/>
			) : activeTab === 'gambling' ? (
				<GamblingPlaceholder />
			) : null}
		</div>
	);
};

export default MerchantOverlay;
