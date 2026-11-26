import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The rebirth confirmation's two free respec tick boxes. (node has no CSS loader: the imports are made no-ops before the component loads.)
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

const draw = async (props: { paragonPoints?: number }) => {
	const { default: RebirthConfirmModal } = await import('../../src/components/game/overlays/RebirthConfirmModal');
	return renderToStaticMarkup(
		React.createElement(RebirthConfirmModal, {
			gain: 12,
			incomeText: '+10%',
			slots: 0,
			candidates: [],
			asking: false,
			onCancel: () => undefined,
			onConfirm: () => undefined,
			...props,
		}),
	);
};

test('the attribute respec is ticked by default (the rebirth as it always was) and says what happens', async () => {
	const out = await draw({});
	assert.match(out, /data-testid="respec-attrs"[^>]*checked|checked=""[^>]*data-testid="respec-attrs"/);
	assert.match(out, /Take back my attribute points/);
	assert.match(out, /Every attribute point goes back/);
});

test('the paragon tick box shows only with paragon points spent, and is not ticked by default', async () => {
	assert.doesNotMatch(await draw({}), /respec-paragon/);
	const out = await draw({ paragonPoints: 37 });
	assert.match(out, /respec-paragon/);
	assert.match(out, /37 paragon points/);
	assert.doesNotMatch(out, /checked=""[^>]*data-testid="respec-paragon"|data-testid="respec-paragon"[^>]*checked/);
});
