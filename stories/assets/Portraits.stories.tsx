import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AssetGallery } from './AssetGallery';

const meta = { title: 'Assets/Portraits', component: AssetGallery, args: { category: 'portraits', scale: 3 } } satisfies Meta<typeof AssetGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
