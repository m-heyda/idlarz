/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FileGallery, type FileEntry } from './FileGallery';

// Map ground, backdrops and the biome/meadow/water icons: the asset manifest leaves them out on purpose (tests/docs/assets.test.ts), so they are listed straight from the folders here.
const found = import.meta.glob(
	['../../public/pixel/bg/*.png', '../../public/pixel/terrain/*.png', '../../public/landing/*.png', '../../public/pixel/icons/{biome,meadow,water}_*.png'],
	{
		eager: true,
		query: '?url',
		import: 'default',
	},
) as Record<string, string>;

const files: FileEntry[] = Object.entries(found)
	.map(([p, src]) => {
		const id = p.replace('../../public', '');
		return { src, id, group: id.split('/').slice(1, -1).join('/') };
	})
	.sort((a, b) => a.id.localeCompare(b.id));

const meta = { title: 'Assets/Map ground and backdrops', component: FileGallery, args: { files, minCard: 200 } } satisfies Meta<typeof FileGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
