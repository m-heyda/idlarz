import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PixelIcon from '@/components/game/PixelIcon';

// The real game component, so a change to PixelIcon or the icon registry shows up here.
const meta = {
	title: 'Components/PixelIcon',
	component: PixelIcon,
	args: { name: 'gold', scale: 2, alt: 'gold' },
	parameters: { layout: 'centered' },
} satisfies Meta<typeof PixelIcon>;
export default meta;

export const Gold: StoryObj<typeof meta> = {};
export const GoldShine: StoryObj<typeof meta> = { args: { shine: true, scale: 3 } };
export const Castle: StoryObj<typeof meta> = { args: { name: 'castle_6', alt: 'castle', scale: 2 } };
