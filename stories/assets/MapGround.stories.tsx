import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';

const meta = { title: 'Assets/Map ground and backdrops', component: AssetGallery, args: { category: 'map-ground', scale: 1 } } satisfies Meta<
	typeof AssetGallery
>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
