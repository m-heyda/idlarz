import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AvatarPicker from '@/components/game/AvatarPicker';
import { AchievementList } from '@/components/game/overlays/AchievementsOverlay';
import RebirthUnlockModal from '@/components/game/overlays/RebirthUnlockModal';
import NewChapterScreen from '@/components/auth/NewChapterScreen';
import HeroCreator from '@/components/auth/HeroCreator';
import PixelModal from '@/components/game/PixelModal';
import { creatorAvatar } from '@/catalog/avatars';
import type { PlayerClassId } from '@/config/playerClasses';
import { ACHIEVEMENTS } from '@/catalog/achievements';
import { AVATARS, STARTER_AVATAR_IDS } from '@/catalog/avatars';
import { rebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import type { Profile } from '@/lib/authClient';

// The new-chapter screens at desktop widths (1240-1920 px). Pure props, no login needed.
const meta = { title: 'Screens/New chapter', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Only the starters are open; every other card is a silhouette with how to earn it. */
export const AvatarsStarters: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24 }}>
			<AvatarPicker value={STARTER_AVATAR_IDS[0]} unlocked={STARTER_AVATAR_IDS} onChange={() => undefined} />
		</div>
	),
};

export const AvatarsAllUnlocked: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24 }}>
			<AvatarPicker value={AVATARS[0].id} unlocked={AVATARS.map((a) => a.id)} onChange={() => undefined} />
		</div>
	),
};

export const AchievementsHalfEarned: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24, color: '#f1e6c8' }}>
			<AchievementList earned={ACHIEVEMENTS.filter((_, i) => i % 2 === 0).map((a) => a.id)} />
		</div>
	),
};

export const AchievementsNoneEarned: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24, color: '#f1e6c8' }}>
			<AchievementList earned={[]} />
		</div>
	),
};

export const RebirthUnlock: Story = {
	render: () => {
		const intro = rebirthUnlockIntro(1);
		return intro ? <RebirthUnlockModal intro={intro} onClose={() => undefined} /> : <p>No biome unlocks at rebirth 1.</p>;
	},
};

const profile = { characterName: 'Hero', playerClass: 'warrior', avatarId: null } as unknown as Profile;

export const NewChapter: Story = {
	render: () => <NewChapterScreen profile={profile} onDone={() => undefined} onLogout={() => undefined} />,
};

const Creator = ({ initial = null, earned = [] }: { initial?: PlayerClassId | null; earned?: string[] }) => {
	const [name, setName] = useState('Lepryko');
	const [playerClass, setClass] = useState<PlayerClassId | null>(initial);
	const [pick, setPick] = useState<string | null>(null);
	return (
		<div style={{ minHeight: '100vh', background: '#14100c', padding: 40 }}>
			<PixelModal title='Finish your hero' size='md' hideClose closeOnBackdrop={false} onClose={() => undefined}>
				<HeroCreator
					name={name}
					onName={setName}
					playerClass={playerClass}
					onClass={(id) => {
						setClass(id);
						setPick(null);
					}}
					avatarId={creatorAvatar(playerClass, pick, earned)}
					onAvatar={setPick}
					earned={earned}
				/>
			</PixelModal>
		</div>
	);
};

/** The hero creation block (sign-up, "Finish your hero", "A new chapter"): nothing chosen yet. */
export const HeroCreatorEmpty: Story = { render: () => <Creator /> };

/** A class chosen: its figure, bonuses and the two avatars it owns. */
export const HeroCreatorMage: Story = { render: () => <Creator initial='mage' /> };

export const HeroCreatorWarrior: Story = { render: () => <Creator initial='warrior' /> };

/** An account that earned an avatar sees it as an extra choice. */
export const HeroCreatorWithEarnedAvatar: Story = { render: () => <Creator initial='paladin' earned={['boss_slayer']} /> };
