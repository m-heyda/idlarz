import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';

const meta = { title: 'Assets/Potions', component: AssetGallery, args: { category: 'potions', scale: 2 } } satisfies Meta<typeof AssetGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
