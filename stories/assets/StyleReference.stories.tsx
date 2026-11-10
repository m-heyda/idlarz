/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FileGallery, type FileEntry } from './FileGallery';

// art_style_reference/ (the pictures the art rules point at; its README files hold the rules) is outside public/; `.storybook/main.ts` serves it at `/art_style_reference/`.
// Only the file names are used (the loaders are never called): the URL of a picture is its path.
const found = import.meta.glob('../../art_style_reference/**/*.{jpg,jpeg,png,gif,webp}', { eager: false });

const files: FileEntry[] = Object.keys(found)
	.map((p) => {
		const id = p.replace('../../', '');
		return { src: `/${id}`, id, group: id.split('/').slice(1, -1).join('/') || 'root' };
	})
	.sort((a, b) => a.id.localeCompare(b.id));

const meta = { title: 'Assets/Style references', component: FileGallery, args: { files, minCard: 260 } } satisfies Meta<typeof FileGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
