// Gem economy sim (IDL-229, docs/plan/30-gem-sinks.md sections 3 and 9): the gem faucets (chests, the daily bonus, achievements, deed milestones) against the gem shop's price book.
//   npm run gem-sim           print the tables
//   npm run gem-sim -- --md   also write docs/generated/gem-sim.md
// The model is pure and lives in scripts/gemSim.ts (tests/economy/gemSim.test.ts pins its numbers). Nothing here is random.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderGemSim, runGemSim } from './gemSim';

const text = renderGemSim(runGemSim());
console.log(text);
if (process.argv.includes('--md')) {
	writeFileSync(resolve(__dirname, '..', 'docs', 'generated', 'gem-sim.md'), text + '\n');
	console.log('wrote docs/generated/gem-sim.md');
}
