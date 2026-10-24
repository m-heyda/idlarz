# Idle Explorer

An idle / incremental territory game. Start with a castle on a 50×50 map, buy adjacent tiles that turn into biomes (forest, plains, hills, swamp, tundra, lake, grounds), grow your income, upgrade the castle, raise farm animals, trade with the merchant, fight the rats (and the Rat King) that wander onto your land, collect and equip gear, level up and spend stat points. Progress is saved automatically in the browser (encrypted, in IndexedDB).

Live: https://idlarz.vercel.app

## Tech stack

- **Next.js 15.5** (App Router) · **React 19** · **TypeScript 5.9**
- **Tailwind CSS 4** · `clsx` + `tailwind-merge`
- **Zustand 5** with `persist` into an encrypted IndexedDB vault (save tools: press Control five times)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000 (dev build shows a cheat/debug panel bottom-left)
npm run build
npm run lint
npm test         # click limiter, economy/exploit and save tests
```

## Documentation

Full design and technical docs live in [`docs/`](docs/README.md):

- [Architecture](docs/01-architecture.md) — files, state, tick loop, persistence
- [Mechanics](docs/02-mechanics.md) — every rule as implemented
- [Formulas & scaling](docs/03-formulas-and-scaling.md) — all maths with tables
- [Unfinished features & known issues](docs/04-unfinished-and-known-issues.md)
- [Balance backlog & roadmap](docs/05-balance-backlog-and-roadmap.md)
- [Playtest & pacing report](docs/06-playtest-and-pacing-report.md) — why the old game finished in ~3 days and what the rebalance changed
- [Saves, security & exploit audit](docs/07-security-and-exploits.md)

Tables and pacing numbers are generated from the real config: `npm run report` (tables), `npm run sim` (bot simulation); `npm test` runs the exploit/save tests.
