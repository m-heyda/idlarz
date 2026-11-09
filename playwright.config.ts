import { defineConfig } from '@playwright/test';

// The smoke test runs against the real Supabase project in .env.local and needs a person to sign in (docs/reference/ops.md), so it is a
// local, headed run: `npm run reset-test-account -- --yes` first, then `npm run e2e` and sign in in the window that opens. It is not part of CI.
// E2E_TEST_PASSWORD (optional) comes from the git-ignored .env.local; the file is loaded here so `npm run e2e` finds it
try {
	process.loadEnvFile('.env.local');
} catch {
	/* no .env.local: sign in by hand */
}

const port = Number(process.env.E2E_PORT ?? 3004);

export default defineConfig({
	testDir: 'e2e',
	timeout: 15 * 60_000, // the person signing in is part of the test
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${port}`,
		headless: false,
		// the installed Chrome, so no browser download is needed; E2E_CHANNEL=chromium uses Playwright's own (npx playwright install chromium)
		channel: process.env.E2E_CHANNEL ?? 'chrome',
		viewport: { width: 1400, height: 900 },
		// no traces: they record request bodies, and the sign-in request carries the test password
		trace: 'off',
		screenshot: 'only-on-failure',
	},
	webServer: {
		command: `npm run dev -- -p ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
