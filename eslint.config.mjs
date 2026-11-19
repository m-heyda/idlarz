import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	{ ignores: ['.next/**', 'node_modules/**', 'public/**', 'scripts/pixel/**', 'storybook-static/**', 'next-env.d.ts'] },
	...compat.extends('next/core-web-vitals', 'next/typescript'),
	// The design-system package is plain pixel-art <img>, shown in Storybook only (no next/image there)
	{ files: ['packages/design-system/**'], rules: { '@next/next/no-img-element': 'off' } },
];

export default eslintConfig;
