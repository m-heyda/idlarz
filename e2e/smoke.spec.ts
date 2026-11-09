// Smoke test of the real game in a real browser (IDL-124). It runs against the Supabase project in .env.local with the ONE test account
// (docs/reference/ops.md): clear it with `npm run reset-test-account -- --yes`, run `npm run e2e`, and SIGN IN BY HAND in the window that opens.
// The test never types a password; it waits for the session and refuses to go on when the account is not the test account.
// The dev server exposes the store as `window.__game` (GameDebug), which the steps below use to read state and to do what has no stable button.
import { expect, test, type Page } from '@playwright/test';
import { TEST_ACCOUNT_EMAIL } from './account';

interface GameWindow {
	__game?: {
		getState: () => {
			isHydrated: boolean;
			playerName: string;
			resources: { gold: number };
			tiles: { stats: { owned: number } };
			buyTile: (x: number, y: number) => boolean;
		};
	};
}

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
	page = await (await browser.newContext()).newPage();
});

test.afterAll(async () => {
	await page.context().close();
});

const SIGN_IN_WAIT_MS = 10 * 60_000;

/** Lets a person through the start hub of a saved game or a new one, and waits until the game store has loaded. */
const waitForGame = async () => {
	await expect
		.poll(
			async () => {
				const startNew = page.getByRole('button', { name: /start a new game/i });
				if (await startNew.isVisible().catch(() => false)) await startNew.click();
				return page.evaluate(() => !!(window as unknown as GameWindow).__game?.getState().isHydrated);
			},
			{ timeout: 60_000, message: 'the game did not load (is the Supabase project in .env.local running?)' },
		)
		.toBe(true);
};

const owned = () => page.evaluate(() => (window as unknown as GameWindow).__game!.getState().tiles.stats.owned);
const gold = () => page.evaluate(() => (window as unknown as GameWindow).__game!.getState().resources.gold);

test('sign in as the test account', async () => {
	// E2E_TEST_PASSWORD (git-ignored .env.local) signs in through the app's own login route; without it a person signs in by hand.
	// E2E_MANUAL_LOGIN=1 forces the by-hand path even when the password is set.
	const password = process.env.E2E_MANUAL_LOGIN ? '' : (process.env.E2E_TEST_PASSWORD ?? '');
	if (password) {
		const login = await page.request.post('/api/auth/login', { data: { email: TEST_ACCOUNT_EMAIL, password } });
		expect(login.status(), `sign-in as ${TEST_ACCOUNT_EMAIL} failed: is E2E_TEST_PASSWORD right for this Supabase project?`).toBe(200);
	}
	await page.goto('/');
	if (!password) console.log(`\n>>> Sign in as ${TEST_ACCOUNT_EMAIL} in the browser window that just opened (the test waits up to 10 minutes).\n`);
	await expect
		.poll(async () => (await page.request.get('/api/auth/me')).status(), { timeout: SIGN_IN_WAIT_MS, intervals: [1000], message: 'nobody signed in' })
		.toBe(200);
	const me = (await (await page.request.get('/api/auth/me')).json()) as { user: { email: string | null } };
	expect(me.user.email?.toLowerCase(), `E2E tests must use ${TEST_ACCOUNT_EMAIL}; log out and sign in with it`).toBe(TEST_ACCOUNT_EMAIL);
});

test('the game opens on a new game', async () => {
	await waitForGame();
	const state = await page.evaluate(() => {
		const s = (window as unknown as GameWindow).__game!.getState();
		return { name: s.playerName, gold: s.resources.gold, owned: s.tiles.stats.owned };
	});
	expect(state.name.length).toBeGreaterThan(0);
	expect(Number.isFinite(state.gold)).toBe(true);
	expect(state.owned).toBeGreaterThan(0);
	await expect(page.getByLabel('Rebirth (not available yet)')).toBeVisible();
});

test('the game keeps running: income arrives', async () => {
	const before = await gold();
	await expect.poll(gold, { timeout: 20_000, message: 'gold did not rise' }).toBeGreaterThan(before);
});

test('a click on the map pays gold', async () => {
	const area = page.locator('[data-click-area]').first();
	await expect(area).toBeVisible();
	const box = (await area.boundingBox())!;
	const before = await gold();
	for (let i = 0; i < 4; i++) {
		await page.mouse.click(box.x + box.width / 2 + i * 3, box.y + box.height / 2 + i * 3);
		await page.waitForTimeout(350);
	}
	expect(await gold()).toBeGreaterThan(before);
});

test('buy a tile', async () => {
	const before = await owned();
	// try the squares around the castle (25,25) until one is a legal, affordable purchase
	const bought = await page.evaluate(() => {
		const game = (window as unknown as GameWindow).__game!;
		for (let r = 1; r <= 4; r++) for (let y = 25 - r; y <= 25 + r; y++) for (let x = 25 - r; x <= 25 + r; x++) if (game.getState().buyTile(x, y)) return true;
		return false;
	});
	expect(bought, 'no tile could be bought: is the account a new game with its starting gold?').toBe(true);
	expect(await owned()).toBe(before + 1);
});

test('the game menu opens Settings', async () => {
	await page.getByLabel('Game menu: settings, save, export').click();
	await page.getByText('Settings', { exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Settings' }).or(page.getByText('Settings', { exact: true }).first())).toBeVisible();
	await page.keyboard.press('Escape');
});

test('save, reload: the game comes back as it was', async () => {
	const tilesBefore = await owned();
	await page.getByLabel('Game menu: settings, save, export').click();
	await page.getByText('Save game').click();
	await page.waitForTimeout(2000); // the local save is written at once; the cloud save follows
	await page.reload();
	await waitForGame();
	expect(await owned()).toBe(tilesBefore);
});
