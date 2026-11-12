import type { Preview } from '@storybook/nextjs-vite';
import '@fontsource-variable/mozilla-headline';
import '@fontsource/titan-one/latin-400.css';
import '../src/app/globals.css';
import '../packages/design-system/src/styles.css';

const preview: Preview = {
	parameters: {
		layout: 'fullscreen',
		backgrounds: { options: { dark: { name: 'dark', value: '#14110f' }, light: { name: 'light', value: '#e9e2d3' } } },
		initialGlobals: { backgrounds: { value: 'dark' } },
	},
};

export default preview;
