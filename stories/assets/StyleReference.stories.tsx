/// <reference types="vite/client" />
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FileGallery, type FileEntry } from './FileGallery';

// art_style_reference/ (the pictures the art rules point at; its README files hold the rules) is outside public/, so Vite serves each file by its own URL.
const found = import.meta.glob('../../art_style_reference/**/*.{jpg,jpeg,png,gif,webp}', { eager: true, query: '?url', import: 'default' }) as Record<
	string,
	string
>;

const files: FileEntry[] = Object.entries(found)
	.map(([p, src]) => {
		const id = p.replace('../../', '');
		return { src, id, group: id.split('/').slice(1, -1).join('/') || 'root' };
	})
	.sort((a, b) => a.id.localeCompare(b.id));

const meta = { title: 'Assets/Style references', component: FileGallery, args: { files, minCard: 260 } } satisfies Meta<typeof FileGallery>;
export default meta;

export const Gallery: StoryObj<typeof meta> = {};
