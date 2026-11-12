import React, { useEffect, useMemo, useState } from 'react';
import { Button, HoverTip, Inset, Panel, ProgressBar, Slot } from '../../../../packages/design-system/src/components/primitives';
import { CollapsibleGroup, CraftQueue, PAPER_INK, Slider, type CraftQueueEntry } from '../../../../packages/design-system/src/components/composites';
import { Tooltip, TipCostList, TipLine } from '../../../../packages/design-system/src/components/tooltips';
import { RARITIES } from '@/catalog';
import { GRADE_INFO } from '@/catalog/items/grades';
import { COMPONENTS, RECIPES, RECIPE_BY_ID, type Recipe, type RecipeKind } from '@/catalog/recipes';
import { gearOdds } from '@/lib/craftGear';
import { craftBlock, craftLevelOf, craftLimit, craftNeeds, craftTimeSec, craftXpOf, craftXpToNext, finishedOf, maxCraftable, stashKeyOf } from '@/lib/crafting';
import { effectiveStats } from '@/lib/effectiveStats';
import { selectQueue, useCraftStore } from '@/stores/craftStore';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatInt, formatTime, parseAmount, tidy } from '@/utils/formatters';
import { componentIconUrl, outputName, recipeIconUrl, resourceIconUrl } from './recipeUi';

const I = PAPER_INK;

/** Crafting XP is small now (`CRAFTING.xpScale`): show up to two decimals below 10, whole numbers above. */
const formatXp = (xp: number): string => (xp >= 10 ? formatInt(xp) : String(Math.round(xp * 100) / 100));

interface Have {
	craftLevel: number;
	resources: Partial<Record<string, number>>;
	stock: Record<string, number>;
}

/** The cost card of a recipe tile: what one craft takes (green when you have it, red when not) and the XP, or the level it unlocks at. */
const RecipeTip: React.FC<{ recipe: Recipe; have: Have }> = ({ recipe, have }) => {
	const locked = have.craftLevel < recipe.unlock;
	const needs = craftNeeds(recipe, 1);
	return (
		<Tooltip icon={recipeIconUrl(recipe)} title={outputName(recipe)} subtitle={recipe.kind}>
			{locked ? (
				<TipLine tone='red'>Unlocks at crafting level {recipe.unlock}</TipLine>
			) : (
				<>
					<TipCostList
						costs={[
							...needs.resources.map((n) => ({
								label: n.key,
								icon: resourceIconUrl(n.key),
								have: have.resources[n.key] ?? 0,
								cost: n.qty,
								text: formatInt(n.qty),
							})),
							...needs.components.map((n) => ({
								label: COMPONENTS[n.id].name,
								icon: componentIconUrl(n.id),
								have: have.stock[n.id] ?? 0,
								cost: n.qty,
								text: String(n.qty),
							})),
						]}
					/>
					<TipLine tone='green'>+{formatXp(craftXpOf(recipe, 1))} XP</TipLine>
				</>
			)}
		</Tooltip>
	);
};

/** The odds of a gear craft at the player's Luck, Intelligence and crafting level and the grade's pity counter: the same request the server rolls (src/lib/craftGear.ts). */
const GearOddsPanel: React.FC<{ recipe: Recipe; craftLevel: number }> = ({ recipe, craftLevel }) => {
	const characterStats = useGameStore((state) => state.characterStats);
	const equipment = useGameStore((state) => state.equipment);
	const prestige = useGameStore((state) => state.prestige);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const pity = useCraftStore((state) => state.craft?.pity);
	if (!('gear' in recipe.output)) return null;
	const target = recipe.output.gear;
	const luck = effectiveStats({ characterStats, equipment, prestige, merchantUpgrades }).luck;
	const odds = gearOdds(target, { craftLevel, luck, intelligence: characterStats.intelligence, pity: pity?.[target.grade] ?? 0 });
	const levels = odds.itemLevel.min === odds.itemLevel.max ? `${odds.itemLevel.min}` : `${odds.itemLevel.min}-${odds.itemLevel.max}`;
	const best = odds.rarities[odds.rarities.length - 1];
	return (
		<div data-slot='gear-odds'>
			<div className='ds-capi'>Odds (Luck {formatInt(Math.round(luck))})</div>
			<div className='ds-odds-rows'>
				{odds.rarities.map((row) => (
					<span key={row.id} className='ds-odds-row'>
						<i style={{ background: RARITIES[row.id as keyof typeof RARITIES]?.color }} />
						{RARITIES[row.id as keyof typeof RARITIES]?.label ?? row.id} {tidy((row.chance * 100).toFixed(row.chance < 0.1 ? 1 : 0))}%
					</span>
				))}
			</div>
			<div className='ds-paper-note'>Item level {levels} (it grows with your crafting level)</div>
			<div className='ds-paper-note'>
				Quality leans up +{Math.round(odds.qualityBias * 100)}% (Intelligence)
				{odds.pityMultiplier > 1 && best
					? `, bad luck bonus x${tidy(odds.pityMultiplier.toFixed(2))} on ${RARITIES[best.id as keyof typeof RARITIES]?.label ?? best.id}`
					: ''}
			</div>
			<div className='ds-paper-note'>You choose the grade and the slot; the piece is random. It goes to your bag, marked Crafted.</div>
		</div>
	);
};

/** The chosen recipe on the paper ticket: what it makes, what the chosen amount costs, the amount (slider and typed field: 1500, 1.5k, 2M), XP, time, the gear odds, and the Queue / Craft button. */
const RecipeTicket: React.FC<{ recipe: Recipe; have: Have }> = ({ recipe, have }) => {
	const busy = useCraftStore((state) => state.busy);
	const craftItem = useCraftStore((state) => state.craftItem);
	const slotsFull = useCraftStore(selectQueue).length >= craftLimit('craftQueueSlots') && !!recipe.timeSec;
	const showToast = useUiStore((state) => state.showToast);
	const perCraft = craftTimeSec(recipe);
	const max = maxCraftable(recipe, have);
	const [wanted, setWanted] = useState(1);
	const [draft, setDraft] = useState<string | null>(null);
	// the amount keeps its value while the stock changes, but never above what can be made now
	const count = Math.min(wanted, max);
	const locked = have.craftLevel < recipe.unlock;
	const held = have.stock[stashKeyOf(recipe)] ?? 0;
	const description = 'component' in recipe.output ? COMPONENTS[recipe.output.component].description : null;
	const isGear = 'gear' in recipe.output;
	const block = count > 0 ? craftBlock(recipe, count, have) : 'resources';
	const needs = craftNeeds(recipe, Math.max(1, count));

	return (
		<Panel parchment className='ds-ledger ds-craft-ticket'>
			<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
				<Slot large icon={recipeIconUrl(recipe)} />
				<div>
					<div className='ds-paper-title'>
						{outputName(recipe)}
						{recipe.output.qty > 1 ? ` x${recipe.output.qty}` : ''}
					</div>
					<div className='ds-paper-sub'>
						{recipe.kind}
						{isGear ? ' · goes to your bag' : ` · you hold ${formatInt(held)}`}
					</div>
				</div>
			</div>
			{description ? <p className='ds-paper-text'>{description}</p> : null}

			{locked ? (
				<p className='ds-paper-text' style={{ color: I.red }}>
					Unlocks at crafting level {recipe.unlock}
				</p>
			) : (
				<>
					<div>
						<div className='ds-capi'>Cost{count > 1 ? ` (x${formatInt(count)})` : ''}</div>
						<div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 6 }}>
							{needs.resources.map((n) => (
								<span key={n.key} className='ds-paper-cost' title={n.key} style={{ color: (have.resources[n.key] ?? 0) >= n.qty ? I.green : I.red }}>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={resourceIconUrl(n.key)} alt={n.key} />
									{formatInt(n.qty)}
								</span>
							))}
							{needs.components.map((n) => (
								<span key={n.id} className='ds-paper-cost' title={COMPONENTS[n.id].name} style={{ color: (have.stock[n.id] ?? 0) >= n.qty ? I.green : I.red }}>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={componentIconUrl(n.id)} alt={COMPONENTS[n.id].name} />
									{formatInt(n.qty)} x {COMPONENTS[n.id].name}
								</span>
							))}
						</div>
					</div>
					<div>
						<label className='ds-capi' htmlFor='hero-craft-amount' style={{ display: 'block' }}>
							Amount
						</label>
						<div style={{ paddingTop: 8 }}>
							<Slider
								id='hero-craft-amount'
								tone='paper'
								min={1}
								max={Math.max(1, max)}
								value={Math.max(1, count)}
								disabled={max === 0}
								onChange={(n) => {
									setDraft(null);
									setWanted(n);
								}}
								readout={
									<>
										<input
											className='ds-paper-input'
											inputMode='text'
											value={draft ?? formatInt(count)}
											disabled={max === 0}
											aria-label='Amount to craft (1500, 1.5k, 2M)'
											onFocus={(event) => event.target.select()}
											onChange={(event) => {
												setDraft(event.target.value);
												const parsed = parseAmount(event.target.value);
												if (parsed !== null) setWanted(parsed);
											}}
											onBlur={() => setDraft(null)}
										/>
										<span> / {formatInt(max)}</span>
									</>
								}
							/>
						</div>
					</div>
					<div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
						<span style={{ color: I.green, fontWeight: 600 }}>+{formatXp(craftXpOf(recipe, count))} XP</span>
						{perCraft > 0 ? (
							<span style={{ color: '#5a4326' }}>
								{formatTime(perCraft)} each{count > 1 ? ` · ${formatTime(perCraft * count)} for ${formatInt(count)}` : ''}
							</span>
						) : null}
					</div>
				</>
			)}

			{isGear && !locked ? <GearOddsPanel recipe={recipe} craftLevel={have.craftLevel} /> : null}

			{/* reserved for the later "infuse with affixes" options (enchanted crafts, legendaries); empty while no recipe has any */}
			<div data-slot='infuse' />

			<Button
				tone='gold'
				style={{ marginTop: 'auto', minHeight: 40 }}
				disabled={locked || !!block || busy || count === 0 || slotsFull}
				aria-label={`${recipe.timeSec ? 'Queue' : 'Craft'} ${count} ${outputName(recipe)}`}
				onClick={() => void craftItem(recipe.id, count).then((text) => showToast(text))}
			>
				{slotsFull ? 'Queue full' : `${recipe.timeSec ? 'Queue' : 'Craft'}${count > 0 ? ` ${formatInt(count)}` : ''}`}
			</Button>
		</Panel>
	);
};

/** The server's clock in ms, ticking once a second (the queue is drawn on it; the server derives the finished count itself). */
const useServerNow = (): number => {
	const offset = useCraftStore((state) => state.clockOffsetMs);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	return now + offset;
};

/** The running batches: progress, Collect for what is finished, Cancel for the rest, Collect all. */
const Queue: React.FC = () => {
	const queue = useCraftStore(selectQueue);
	const busy = useCraftStore((state) => state.busy);
	const claim = useCraftStore((state) => state.claim);
	const cancel = useCraftStore((state) => state.cancel);
	const showToast = useUiStore((state) => state.showToast);
	const now = useServerNow();
	const entries: CraftQueueEntry[] = queue.map((entry, slot) => {
		const recipe = RECIPE_BY_ID[entry.recipeId];
		const done = finishedOf(entry, now);
		const left = Math.max(0, (entry.count - done) * entry.timeSec - (now - entry.startedAt) / 1000 + done * entry.timeSec);
		const stalled = done < entry.count && now - entry.startedAt >= craftLimit('craftOfflineHours') * 3_600_000;
		return {
			id: slot,
			name: recipe ? outputName(recipe) : entry.recipeId,
			icon: recipe ? recipeIconUrl(recipe) : componentIconUrl('glass_vial'),
			count: entry.count,
			done,
			status: stalled ? 'waiting for you' : done >= entry.count ? 'done' : formatTime(left),
		};
	});
	const act = (run: () => Promise<string>) => !busy && void run().then((text) => showToast(text));
	return (
		<CraftQueue
			entries={entries}
			slots={craftLimit('craftQueueSlots')}
			onCollect={(id) => act(() => claim(Number(id)))}
			onCancel={(id) => act(() => cancel(Number(id)))}
			onCollectAll={() => act(() => claim('all'))}
			stacked
		/>
	);
};

/** The groups of the recipe list, in display order; a kind with no recipe is not shown. */
const KIND_LABELS: Record<RecipeKind, string> = { component: 'Components', potion: 'Potions', good: 'Trade goods', gear: 'Gear' };
/** Gear recipes are shown per grade ("Hide - from crafting level 8"); every other kind is one grid. */
const groupsOf = (recipes: Recipe[]): { label: string; recipes: Recipe[] }[] => {
	const groups: { label: string; recipes: Recipe[] }[] = [];
	for (const recipe of recipes) {
		const label = 'gear' in recipe.output ? `${GRADE_INFO[recipe.output.gear.grade].label} · from crafting level ${recipe.unlock}` : '';
		const group = groups.find((g) => g.label === label);
		if (group) group.recipes.push(recipe);
		else groups.push({ label, recipes: [recipe] });
	}
	return groups;
};
const KINDS = (Object.keys(KIND_LABELS) as RecipeKind[]).filter((kind) => RECIPES.some((r) => r.kind === kind));

/**
 * The left column of the Crafting tab: the crafting level and its XP bar on top, the queue under it (Collect all lights up when something finished), and the blacksmith filling the rest. It stands in for the hero card on this tab, so the recipes
 * and the ticket get the room.
 */
export const CraftingSidebar: React.FC = () => {
	const craft = useCraftStore((state) => state.craft);
	const refresh = useCraftStore((state) => state.refresh);
	useEffect(() => void refresh(), [refresh]);
	const { level, progress } = craftLevelOf(craft?.xp ?? 0);
	const next = craftXpToNext(level);
	return (
		<Panel className='ds-hero-left ds-craft-side'>
			<div className='ds-craft-level'>
				<div className='ds-craft-level-line'>
					<span className='ds-gold-text'>Crafting level {level}</span>
					<span className='ds-dim' style={{ fontSize: 12 }}>
						{Number.isFinite(next) ? `${formatInt(Math.floor(next * progress))} / ${formatInt(next)} XP` : 'MAX'}
					</span>
				</div>
				<ProgressBar
					tone='xp'
					value={Number.isFinite(next) ? Math.floor(next * progress) : 1}
					max={Number.isFinite(next) ? next : 1}
					label={`${Math.floor(progress * 100)}%`}
				/>
			</div>
			<Queue />
			<div className='ds-craft-smith'>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src='/pixel/new_assets/crafting/blacksmith.png' alt='' draggable={false} />
			</div>
		</Panel>
	);
};

/**
 * The Crafting tab of the Hero window (the right side; the level and the queue are in `CraftingSidebar`): the crafting level bar, the queue (Collect all lights up when something finished), the recipe list in folding groups (a locked recipe is dimmed, hover shows its cost and XP) next to the paper ticket of the chosen recipe.
 * Everything the old Crafting window did: amount by slider or typed text, cost colours, XP and time, gear odds, queue slots, Collect, Cancel.
 */
const HeroCrafting: React.FC = () => {
	const craft = useCraftStore((state) => state.craft);
	const refresh = useCraftStore((state) => state.refresh);
	const resources = useGameStore((state) => state.resources);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [closed, setClosed] = useState<ReadonlySet<RecipeKind>>(new Set());
	useEffect(() => void refresh(), [refresh]);

	const { level } = craftLevelOf(craft?.xp ?? 0);
	const have: Have = useMemo(() => ({ craftLevel: level, resources, stock: craft?.stock ?? {} }), [level, resources, craft?.stock]);
	const selected = RECIPES.find((r) => r.id === selectedId) ?? RECIPES.find((r) => r.unlock <= level) ?? RECIPES[0];
	const toggleKind = (kind: RecipeKind) =>
		setClosed((before) => {
			const out = new Set(before);
			if (out.has(kind)) out.delete(kind);
			else out.add(kind);
			return out;
		});

	return (
		<div className='ds-craft'>
			<div className='ds-craft-body'>
				<Inset className='ds-craft-list'>
					{KINDS.map((kind) => {
						const recipes = RECIPES.filter((r) => r.kind === kind);
						return (
							<CollapsibleGroup key={kind} title={KIND_LABELS[kind]} count={recipes.length} open={!closed.has(kind)} onToggle={() => toggleKind(kind)}>
								{groupsOf(recipes).map((group) => (
									<React.Fragment key={group.label || kind}>
										{group.label ? <div className='ds-craft-sub'>{group.label}</div> : null}
										<div className='ds-craft-grid'>
											{group.recipes.map((recipe) => {
												const locked = have.craftLevel < recipe.unlock;
												return (
													<HoverTip key={recipe.id} tip={<RecipeTip recipe={recipe} have={have} />}>
														<Slot
															icon={recipeIconUrl(recipe)}
															locked={locked}
															active={recipe.id === selected.id}
															aria-label={`${outputName(recipe)}${locked ? `, unlocks at crafting level ${recipe.unlock}` : ''}`}
															onClick={() => setSelectedId(recipe.id)}
														/>
													</HoverTip>
												);
											})}
										</div>
									</React.Fragment>
								))}
							</CollapsibleGroup>
						);
					})}
					<p className='ds-craft-sub'>Crafting level never resets. New recipes unlock as it grows.</p>
				</Inset>
				<RecipeTicket key={selected.id} recipe={selected} have={have} />
			</div>
		</div>
	);
};

export default HeroCrafting;
