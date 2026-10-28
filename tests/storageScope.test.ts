import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDev, scoped } from '../src/lib/storageScope';

// Local development gets its own storage keys; a real site keeps the plain ones.

const withHost = (hostname: string | null, run: () => void) => {
	const g = globalThis as { window?: unknown };
	const before = g.window;
	if (hostname === null) delete g.window;
	else g.window = { location: { hostname } };
	try {
		run();
	} finally {
		if (before === undefined) delete g.window;
		else g.window = before;
	}
};

test('on localhost, loopback addresses and *.localhost the keys get a .dev suffix', () => {
	for (const host of ['localhost', '127.0.0.1', '[::1]', 'app.localhost']) {
		withHost(host, () => {
			assert.equal(isLocalDev(), true, host);
			assert.equal(scoped('idlarz.save'), 'idlarz.save.dev', host);
		});
	}
});

test('on a real host, and without a window (server, tests), the keys are unchanged', () => {
	for (const host of ['idlarz.example.com', 'notlocalhost.com', 'localhost.evil.com', '192.168.1.5']) {
		withHost(host, () => {
			assert.equal(isLocalDev(), false, host);
			assert.equal(scoped('idlarz.save'), 'idlarz.save', host);
		});
	}
	withHost(null, () => assert.equal(scoped('idlarz.save'), 'idlarz.save'));
});
