import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AvatarPicker from '@/components/game/AvatarPicker';
import { AchievementList } from '@/components/game/overlays/AchievementsOverlay';
import RebirthUnlockModal from '@/components/game/overlays/RebirthUnlockModal';
import NewChapterScreen from '@/components/auth/NewChapterScreen';
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
