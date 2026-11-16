import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';
import { SetsView } from './SetsView';

const meta = { title: 'Assets/Equipment sets', component: AssetGallery, args: { category: 'sets', scale: 1 } } satisfies Meta<typeof AssetGallery>;
export default meta;

/** Every piece of every set as a card (filter by status, slot or set name). */
export const Gallery: StoryObj<typeof meta> = {};

/** One row per set: armor, weapons and accessories side by side. */
export const BySet: StoryObj = { render: () => <SetsView /> };
