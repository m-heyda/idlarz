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
import { classAvatarIds } from '@/catalog/avatars';
import { rebirthRunSummary, rebirthUnlockIntro } from '@/utils/game/rebirthUnlocks';
import type { PrestigeState } from '@/types/game';
import type { Profile } from '@/lib/authClient';

// The new-chapter screens at desktop widths (1240-1920 px). Pure props, no login needed.
const meta = { title: 'Screens/New chapter', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A warrior with nothing earned: its two starters are open, the other classes' starters are dimmed with "Needs the <Class> class", the rewards are silhouettes with how to earn them. */
export const AvatarsStarters: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24 }}>
			<AvatarPicker value='knight' playerClass='warrior' unlocked={classAvatarIds('warrior', [])} onChange={() => undefined} />
		</div>
	),
};

/** A mage with every reward earned: the rewards are open to every class, the other classes' starters stay disabled. */
export const AvatarsAllUnlocked: Story = {
	render: () => (
		<div style={{ width: 720, padding: 24 }}>
			<AvatarPicker
				value='boss_slayer'
				playerClass='mage'
				unlocked={classAvatarIds('mage', ['castle_10', 'first_rebirth', 'boss_auroch', 'early_tester'])}
				onChange={() => undefined}
			/>
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

const prestigeOf = (rebirths: number, gained: number, earnedBefore: number): { before: PrestigeState; after: PrestigeState } => ({
	before: { rebirths: rebirths - 1, legacyPoints: 0, legacyEarned: earnedBefore, upgrades: {} },
	after: { rebirths, legacyPoints: gained, legacyEarned: earnedBefore + gained, upgrades: {} },
});

/** A finished run of the first rebirth: made-up but plausible numbers. */
const runOf = (rebirths: number) =>
	rebirthRunSummary({
		ownedTiles: 436,
		castleLevel: 8,
		level: 34,
		playSeconds: 61_200,
		rates: { gold: 61.4, wood: 22.8, stone: 19.1, food: 11.2, coal: 4.2, hide: 0 },
		kills: 1287,
		...prestigeOf(rebirths, 38, rebirths > 1 ? 120 : 0),
	});

/** The rebirth result: Embers, income bonus, the new land with its monsters, and the collapsed "run stats". */
export const RebirthUnlock: Story = {
	render: () => <RebirthUnlockModal run={runOf(1)} intro={rebirthUnlockIntro(1)} onClose={() => undefined} />,
};

/** A rebirth that unlocks nothing new (the sixth and later): only the Embers and the stats. */
export const RebirthNoUnlock: Story = {
	render: () => <RebirthUnlockModal run={runOf(7)} intro={rebirthUnlockIntro(7)} onClose={() => undefined} />,
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
