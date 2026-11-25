import React, { useMemo } from 'react';
import { BestiaryPanel } from '../../../packages/design-system/src/views/bestiary';
import { activeTextOf, biomeGoalsOf, entriesOf, goldenTextOf, type BestiaryInput } from '@/lib/bestiary/entries';
import { useBestiaryStore } from '@/stores/bestiaryStore';
import GameWindow from './GameWindow';

/** What the Bestiary store holds, as the input of the entry builder (the server's numbers; the browser decides nothing). */
export const useBestiaryInput = (): BestiaryInput => {
	const loaded = useBestiaryStore((s) => s.loaded);
	const seen = useBestiaryStore((s) => s.seen);
	const kills = useBestiaryStore((s) => s.kills);
	const claimed = useBestiaryStore((s) => s.claimed);
	const biomeClaimed = useBestiaryStore((s) => s.biomeClaimed);
	const deaths = useBestiaryStore((s) => s.deaths);
	const bestMs = useBestiaryStore((s) => s.bestMs);
	return useMemo(() => ({ loaded, seen, kills, claimed, biomeClaimed, deaths, bestMs }), [loaded, seen, kills, claimed, biomeClaimed, deaths, bestMs]);
};

/**
 * The Bestiary (IDL-322): every monster of the roster as a card (a dark "?" until the first fight), a paper detail with lore, records, the mastery ladder (Claim per reached tier, Claim all), stats with level controls and the drop table, and the biome collection goals.
 * Everything shown comes from the server's report (`useBestiaryStore`); a claim is one request the server judges. The window is resizable like the others and the panel re-flows by its own width (a CSS container).
 */
const BestiaryWindow: React.FC = () => {
	const input = useBestiaryInput();
	const busy = useBestiaryStore((s) => s.busy);
	const claim = useBestiaryStore((s) => s.claim);
	const entries = useMemo(() => entriesOf(input), [input]);
	const biomes = useMemo(() => biomeGoalsOf(input), [input]);
	return (
		<GameWindow id='bestiary' title='Bestiary' width={1080} height={700}>
			<BestiaryPanel
				entries={entries}
				biomes={biomes}
				activeText={activeTextOf(input)}
				goldenText={goldenTextOf()}
				busy={busy}
				onClaim={(id, tier) => void claim({ action: 'claim', type: id, tier })}
				onClaimBiome={(biome, tier) => void claim({ action: 'claimBiome', biome, tier })}
				onClaimAll={() => void claim({ action: 'claimAll' })}
			/>
		</GameWindow>
	);
};

export default BestiaryWindow;
