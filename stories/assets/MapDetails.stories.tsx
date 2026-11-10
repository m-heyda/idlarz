import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';

const meta = { title: 'Assets/Map details', component: AssetGallery, args: { category: 'map-details', scale: 2 } } satisfies Meta<typeof AssetGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
