// Import this first: the sim plays the real store, which needs a `localStorage` and a `fetch` before it loads.

// The bot plays the real store, whose merchant trades ask the server too. There is no server here: a request that never answers keeps the preview as it is and, unlike a real connection, does not keep the process alive after the run.
globalThis.fetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;

// zustand's persist middleware needs *a* storage; the sim replaces it with a no-op one in `loadCtx`
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};
