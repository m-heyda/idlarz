import type { StorybookConfig } from '@storybook/nextjs-vite';

// Storybook for the asset library and the art-facing components. `/pixel/...` URLs resolve against public/ exactly as in the game.
const config: StorybookConfig = {
	stories: ['../stories/**/*.stories.@(ts|tsx)'],
	addons: ['@storybook/addon-docs'],
	framework: '@storybook/nextjs-vite',
	staticDirs: ['../public'],
};

export default config;
