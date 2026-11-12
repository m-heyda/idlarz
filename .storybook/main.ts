import type { StorybookConfig } from '@storybook/nextjs-vite';

// Storybook for the asset library and the art-facing components. `/pixel/...` URLs resolve against public/ exactly as in the game; the style reference pictures are served at `/art_style_reference/...`.
const config: StorybookConfig = {
	stories: ['../stories/**/*.stories.@(ts|tsx)', '../packages/design-system/**/*.stories.@(ts|tsx)'],
	addons: ['@storybook/addon-docs'],
	framework: '@storybook/nextjs-vite',
	staticDirs: ['../public', { from: '../art_style_reference', to: '/art_style_reference' }],
};

export default config;
