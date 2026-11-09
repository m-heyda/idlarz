import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';

const meta = { title: 'Assets/Unsorted cuts', component: AssetGallery, args: { category: 'unsorted', scale: 2 } } satisfies Meta<typeof AssetGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
