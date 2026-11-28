/**
 * How the map pans in a real browser: opens `/map-perf` (the real Grid, game store and 100 ms tick on a synthetic world), drags the map around for a few
 * seconds and reports frame times, in Firefox and Chromium, with and without parts of the page switched off to tell which part costs what.
 *
 *     npm run dev -- -p 3005            (another terminal)
 *     node scripts/perf-map.mjs [--tiles 5000] [--seconds 4] [--browsers firefox,chromium] [--variants all|base,notick]
 *
 * A frame time is the gap between two requestAnimationFrame callbacks while the pointer drags (16.7 ms is 60 fps). Run it with nothing else busy and with the
 * browser's developer tools closed: Firefox's inspector alone makes a DOM-heavy page several times slower.
 *
 * @title Map pan benchmark (scripts/perf-map.mjs)
 * @category Ops/Map performance
 * @order 2
 */
import { chromium, firefox } from '@playwright/test';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > -1 ? process.argv[i + 1] : fallback;
};
const tiles = Number(arg('tiles', 5000));
const seconds = Number(arg('seconds', 4));
const port = arg('port', '3005');
const profile = process.argv.includes('--profile');
const zoom = Number(arg('zoom', 1));
const browsers = arg('browsers', 'firefox,chromium').split(',');

const WATER = '.px-shine,.px-ripple,.px-shimmer,.px-boat,.px-dolphin,.px-bubble,.px-fall{display:none !important}';
const FOG = '.fog-layer{display:none !important}';
const VARIANTS = {
	base: { query: '', css: '' },
	notick: { query: '&tick=0', css: '' },
	nowater: { query: '', css: WATER },
	nofog: { query: '', css: FOG },
	noanim: { query: '', css: '*,*::before,*::after{animation:none !important;transition:none !important}' },
	'notick+noanim': { query: '&tick=0', css: '*,*::before,*::after{animation:none !important;transition:none !important}' },
};
const wanted = arg('variants', 'all') === 'all' ? Object.keys(VARIANTS) : arg('variants').split(',');

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

const run = async (browser, variant) => {
	const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: false });
	await page.goto(`http://localhost:${port}/map-perf?n=${tiles}${variant.query}`, { waitUntil: 'load', timeout: 180_000 });
	await page.waitForSelector('[id^="tile-"]', { timeout: 120_000 });
	if (variant.css) await page.addStyleTag({ content: variant.css });
	if (zoom !== 1) await page.evaluate((z) => window.__mapPerf.view.getState().setZoom(z), zoom);
	await page.waitForTimeout(1500); // terrain chunks drawn, first monsters spawned

	const facts = await page.evaluate(() => ({
		tileNodes: document.querySelectorAll('[id^="tile-"]').length,
		domNodes: document.querySelectorAll('.map-root *').length,
		animations: document.getAnimations().length,
		canvases: document.querySelectorAll('.map-root canvas').length,
	}));
	facts.animNames = await page.evaluate(() => {
		const count = {};
		for (const a of document.getAnimations()) {
			const k = `${a.animationName ?? a.transitionProperty ?? '?'}`;
			count[k] = (count[k] ?? 0) + 1;
		}
		return JSON.stringify(count);
	});

	await page.evaluate(() => {
		window.__frames = [];
		let last = performance.now();
		const loop = (now) => {
			window.__frames.push(now - last);
			last = now;
			window.__raf = requestAnimationFrame(loop);
		};
		window.__raf = requestAnimationFrame(loop);
	});

	const cdp = profile && page.context().newCDPSession ? await page.context().newCDPSession(page) : null;
	if (cdp) {
		await cdp.send('Profiler.enable');
		await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
		await cdp.send('Profiler.start');
	}

	// drag in a wide figure of eight; the map clamps the view to the explored land
	const cx = 800;
	const cy = 450;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	const t0 = Date.now();
	while (Date.now() - t0 < seconds * 1000) {
		const t = (Date.now() - t0) / 1000;
		await page.mouse.move(cx + Math.sin(t * 2.1) * 520, cy + Math.sin(t * 4.2) * 240);
	}
	await page.mouse.up();
	if (cdp) {
		const { profile: prof } = await cdp.send('Profiler.stop');
		const self = new Map();
		const byId = new Map(prof.nodes.map((n) => [n.id, n]));
		const dt = prof.timeDeltas;
		prof.samples.forEach((id, i) => {
			const f = byId.get(id).callFrame;
			const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
			self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
		});
		// who called the native calls (drawImage, getBoundingClientRect ...): the nearest parent with a source file
		const parent = new Map();
		prof.nodes.forEach((n) => (n.children ?? []).forEach((c) => parent.set(c, n.id)));
		const callers = new Map();
		prof.samples.forEach((id, i) => {
			const f = byId.get(id).callFrame;
			if (f.url) return;
			let p = parent.get(id);
			while (p && !byId.get(p).callFrame.url) p = parent.get(p);
			const pf = p ? byId.get(p).callFrame : null;
			const key = `${f.functionName || '(anon)'} <- ${pf ? `${pf.functionName || '(anon)'} ${pf.url.split('/').slice(-1)[0]}:${pf.lineNumber}` : '?'}`;
			callers.set(key, (callers.get(key) ?? 0) + (dt[i] ?? 0));
		});
		console.log('  native self time by caller:');
		[...callers.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.forEach(([k, v]) => console.log(`   ${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`));
		const total = [...self.values()].reduce((a, b) => a + b, 0);
		console.log(`  top self time (${(total / 1000).toFixed(0)} ms sampled):`);
		[...self.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 14)
			.forEach(([k, v]) => console.log(`   ${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`));
	}

	const frames = await page.evaluate(() => {
		cancelAnimationFrame(window.__raf);
		return window.__frames.slice(5);
	});
	await page.close();
	const sorted = [...frames].sort((a, b) => a - b);
	const sum = frames.reduce((a, b) => a + b, 0);
	return {
		fps: +((frames.length / sum) * 1000).toFixed(1),
		p50: +pct(sorted, 0.5).toFixed(1),
		p95: +pct(sorted, 0.95).toFixed(1),
		worst: +sorted[sorted.length - 1].toFixed(1),
		over33: frames.filter((f) => f > 33).length,
		...facts,
	};
};

for (const name of browsers) {
	// PERF_FIREFOX / PERF_CHROMIUM: a browser binary other than the one this Playwright version downloads
	const executablePath = process.env[`PERF_${name.toUpperCase()}`] || undefined;
	const browser = await { firefox, chromium }[name].launch({ headless: true, executablePath });
	console.log(`\n${name} ${browser.version()}, ${tiles} tiles, zoom ${zoom}, ${seconds}s of dragging`);
	const rows = {};
	for (const v of wanted) rows[v] = await run(browser, VARIANTS[v]);
	for (const r of Object.values(rows)) delete r.animNames;
	console.table(rows);
	await browser.close();
}
