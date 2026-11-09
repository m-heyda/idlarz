import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COMPONENTS, RECIPES, RECIPE_BY_ID, type Recipe, type RecipeKind } from '@/catalog/recipes';
import { ITEM_CATALOG } from '@/catalog';
import { craftBlock, craftLevelOf, craftLimit, craftNeeds, craftTimeSec, craftXpToNext, finishedOf, maxCraftable, stashKeyOf } from '@/lib/crafting';
import type { Box } from '@/lib/tipPlacement';
import { selectQueue, useCraftStore } from '@/stores/craftStore';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber, formatTime, parseAmount } from '@/utils/formatters';
import type { PixelIconName } from '@/config/pixelIcons';
import ResourceIcon from '../ResourceIcon';
import PixelIcon from '../PixelIcon';
import { FloatingTip } from '../ItemSlot';
import { itemIconName } from '../itemUi';
import './CraftingOverlay.css';

/** Whole crafts are counted as integers (formatNumber would show 7.00) */
const whole = (n: number) => n.toLocaleString('en');

const outputName = (recipe: Recipe) => ('item' in recipe.output ? ITEM_CATALOG[recipe.output.item].name : COMPONENTS[recipe.output.component].name);

/** Components have no catalog item, so their sprite is named here. */
const COMPONENT_ICONS: Record<string, PixelIconName> = { glass_vial: 'comp_glass_vial' };

export const recipeIcon = (recipe: Recipe): PixelIconName =>
	'item' in recipe.output ? itemIconName(ITEM_CATALOG[recipe.output.item]) : (COMPONENT_ICONS[recipe.output.component] ?? 'comp_glass_vial');

interface Have {
	craftLevel: number;
	resources: Partial<Record<string, number>>;
	stock: Record<string, number>;
}

/** What one craft takes, as chips: green when the player has it, red when not. `count` scales the numbers. */
const CostChips: React.FC<{ recipe: Recipe; count: number; have: Have }> = ({ recipe, count, have }) => {
	const needs = craftNeeds(recipe, count);
	return (
		<span className='cr-cost'>
			{needs.resources.map((n) => (
				<span key={n.key} className={(have.resources[n.key] ?? 0) >= n.qty ? 'cr-ok' : 'cr-lack'}>
					<ResourceIcon resource={n.key} />
					{formatNumber(n.qty)}
				</span>
			))}
			{needs.components.map((n) => (
				<span key={n.id} className={(have.stock[n.id] ?? 0) >= n.qty ? 'cr-ok' : 'cr-lack'}>
					<PixelIcon name={COMPONENT_ICONS[n.id] ?? 'comp_glass_vial'} scale={0.6} alt='' />
					{n.qty} x {COMPONENTS[n.id].name}
				</span>
			))}
		</span>
	);
};

/** One recipe as a bag tile: its sprite; grey with a lock while the level is too low, dim while it cannot be afforded. Hover shows the cost card. */
const RecipeTile: React.FC<{ recipe: Recipe; have: Have; selected: boolean; onSelect: () => void }> = ({ recipe, have, selected, onSelect }) => {
	const [tip, setTip] = useState<Box | null>(null);
	const ref = useRef<HTMLButtonElement>(null);
	const locked = have.craftLevel < recipe.unlock;
	const state = locked ? 'locked' : maxCraftable(recipe, have) > 0 ? 'ready' : 'short';
	const open = () => {
		const r = ref.current?.getBoundingClientRect();
		if (r) setTip({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
	};
	return (
		<>
			<button
				ref={ref}
				className='cr-tile inv-slot'
				data-state={state}
				data-selected={selected}
				aria-label={`${outputName(recipe)}${locked ? `, unlocks at crafting level ${recipe.unlock}` : ''}`}
				onClick={onSelect}
				onPointerEnter={open}
				onPointerLeave={() => setTip(null)}
				onFocus={open}
				onBlur={() => setTip(null)}
			>
				<PixelIcon name={recipeIcon(recipe)} alt='' />
				{locked && <span className='cr-tile-lock'>L{recipe.unlock}</span>}
			</button>
			{tip && (
				<FloatingTip anchor={tip}>
					<div className='px-tooltip cr-tip'>
						<div className='px-tip-title'>{outputName(recipe)}</div>
						<div className='px-tip-muted'>{recipe.kind}</div>
						{locked ? (
							<div className='cr-lack'>Unlocks at crafting level {recipe.unlock}</div>
						) : (
							<>
								<CostChips recipe={recipe} count={1} have={have} />
								<div className='cr-xp'>+{formatNumber(recipe.xp)} XP</div>
							</>
						)}
					</div>
				</FloatingTip>
			)}
		</>
	);
};

/** The chosen recipe: what it makes, what it costs for the chosen amount, the 0..max slider and the craft button. */
const RecipeDetail: React.FC<{ recipe: Recipe; have: Have }> = ({ recipe, have }) => {
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
	const block = count > 0 ? craftBlock(recipe, count, have) : 'resources';

	return (
		<div className='cr-detail'>
			<div className='cr-detail-head'>
				<span className='cr-detail-icon'>
					<PixelIcon name={recipeIcon(recipe)} scale={1.5} alt='' />
				</span>
				<div>
					<h3 className='cr-name'>
						{outputName(recipe)}
						{recipe.output.qty > 1 ? ` x${recipe.output.qty}` : ''}
					</h3>
					<div className='px-tip-muted'>
						{recipe.kind}
						{` - you hold ${formatNumber(held)}`}
					</div>
				</div>
			</div>
			{description && <p className='cr-desc'>{description}</p>}

			{locked ? (
				<p className='cr-lack'>Unlocks at crafting level {recipe.unlock}</p>
			) : (
				<>
					<div className='cr-label'>Cost{count > 1 ? ` (x${formatNumber(count)})` : ''}</div>
					<CostChips recipe={recipe} count={Math.max(1, count)} have={have} />

					<div className='cr-qty'>
						<span className='cr-label'>Amount</span>
						<input
							className='cr-qty-input'
							inputMode='text'
							value={draft ?? whole(count)}
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
						<span className='cr-qty-n'>/ {formatNumber(max)}</span>
					</div>
					<div className='cr-chips'>
						{[1, 10, 100, 1000].map((n) => (
							<button
								key={n}
								className='px-btn px-btn-sm'
								disabled={max === 0}
								onClick={() => {
									setDraft(null);
									setWanted(n);
								}}
							>
								x{formatNumber(n)}
							</button>
						))}
						<button
							className='px-btn px-btn-sm'
							disabled={max === 0}
							onClick={() => {
								setDraft(null);
								setWanted(max);
							}}
						>
							Max
						</button>
					</div>
					<div className='cr-xp'>+{formatNumber(recipe.xp * count)} XP</div>
					{perCraft > 0 && (
						<div className='px-tip-muted'>
							{formatTime(perCraft)} each{count > 1 ? `, ${formatTime(perCraft * count)} for ${formatNumber(count)}` : ''}
						</div>
					)}
				</>
			)}

			{/* reserved for the later "infuse with affixes" options (gear, legendaries); empty while no recipe has any */}
			<div className='cr-infuse' data-slot='infuse' />

			<button
				className='px-btn cr-craft'
				disabled={locked || !!block || busy || count === 0 || slotsFull}
				aria-label={`${recipe.timeSec ? 'Queue' : 'Craft'} ${count} ${outputName(recipe)}`}
				onClick={() => void craftItem(recipe.id, count).then((text) => showToast(text))}
			>
				{recipe.timeSec ? 'Queue' : 'Craft'}
				{count > 0 ? ` x${formatNumber(count)}` : ''}
			</button>
		</div>
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

/** The running batches: progress, Collect for what is finished, Cancel for the rest. An idle line while nothing runs. */
const QueuePanel: React.FC = () => {
	const queue = useCraftStore(selectQueue);
	const busy = useCraftStore((state) => state.busy);
	const claim = useCraftStore((state) => state.claim);
	const cancel = useCraftStore((state) => state.cancel);
	const showToast = useUiStore((state) => state.showToast);
	const now = useServerNow();
	const anyReady = queue.some((entry) => finishedOf(entry, now) >= 1);
	if (queue.length === 0)
		return (
			<div className='cr-progress' data-slot='craft-progress'>
				<span className='px-tip-muted'>Idle</span>
			</div>
		);
	return (
		<div className='cr-queue' data-slot='craft-progress'>
			<div className='cr-queue-head'>
				<span className='px-tip-muted'>
					Queue {queue.length} / {craftLimit('craftQueueSlots')}
				</span>
				<button
					className='px-btn px-btn-sm'
					disabled={busy || !anyReady}
					aria-label='Collect all finished crafts'
					onClick={() => void claim('all').then((text) => showToast(text))}
				>
					Collect all
				</button>
			</div>
			{queue.map((entry, slot) => {
				const recipe = RECIPE_BY_ID[entry.recipeId];
				const done = finishedOf(entry, now);
				const left = Math.max(0, (entry.count - done) * entry.timeSec - (now - entry.startedAt) / 1000 + done * entry.timeSec);
				const stalled = done < entry.count && now - entry.startedAt >= craftLimit('craftOfflineHours') * 3_600_000;
				return (
					<div key={`${entry.recipeId}-${entry.startedAt}`} className='cr-queue-row'>
						<span className='cr-queue-name'>{recipe ? outputName(recipe) : entry.recipeId}</span>
						<div
							className='cr-xpbar cr-queue-bar'
							role='progressbar'
							aria-valuemin={0}
							aria-valuemax={entry.count}
							aria-valuenow={done}
							aria-label='Batch progress'
						>
							<div className='cr-xpfill' style={{ width: `${(done / entry.count) * 100}%` }} />
							<span className='cr-xptext'>
								{whole(done)} / {whole(entry.count)} - {stalled ? 'waiting for you' : done >= entry.count ? 'done' : formatTime(left)}
							</span>
						</div>
						<button className='px-btn' disabled={busy} aria-label='Cancel batch' onClick={() => void cancel(slot).then((text) => showToast(text))}>
							Cancel
						</button>
						<button
							className='px-btn'
							disabled={busy || done < 1}
							aria-label='Collect finished crafts'
							onClick={() => void claim(slot).then((text) => showToast(text))}
						>
							Collect{done > 0 ? ` ${whole(done)}` : ''}
						</button>
					</div>
				);
			})}
		</div>
	);
};

/** The category chips above the recipe grid, in display order; a kind with no recipe is not shown. */
const KIND_LABELS: Record<RecipeKind, string> = { component: 'Components', potion: 'Potions', good: 'Trade goods', gear: 'Gear' };
const KINDS = (Object.keys(KIND_LABELS) as RecipeKind[]).filter((kind) => RECIPES.some((r) => r.kind === kind));

const CraftingOverlay: React.FC = () => {
	const craft = useCraftStore((state) => state.craft);
	const refresh = useCraftStore((state) => state.refresh);
	const resources = useGameStore((state) => state.resources);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [hidden, setHidden] = useState<ReadonlySet<RecipeKind>>(new Set());
	useEffect(() => void refresh(), [refresh]);

	const xp = craft?.xp ?? 0;
	const { level, progress } = craftLevelOf(xp);
	const next = craftXpToNext(level);
	const have: Have = useMemo(() => ({ craftLevel: level, resources, stock: craft?.stock ?? {} }), [level, resources, craft?.stock]);
	const shown = useMemo(() => RECIPES.filter((r) => !hidden.has(r.kind)), [hidden]);
	const selected = shown.find((r) => r.id === selectedId) ?? shown.find((r) => r.unlock <= level) ?? shown[0] ?? RECIPES[0];
	const toggleKind = (kind: RecipeKind) =>
		setHidden((before) => {
			const next = new Set(before);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});

	return (
		<div className='cr-root'>
			<aside className='cr-side'>
				<PixelIcon name='menu_crafting' scale={3} alt='Anvil' />
				<div className='cr-level'>Level {level}</div>
			</aside>

			<div className='cr-main'>
				<div className='cr-xpline'>
					<span className='cr-level-text'>Crafting level {level}</span>
					<span className='px-tip-muted'>{Number.isFinite(next) ? `${formatNumber(Math.floor(next * progress))} / ${formatNumber(next)} XP` : 'MAX'}</span>
				</div>
				<div
					className='cr-xpbar'
					role='progressbar'
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.floor(progress * 100)}
					aria-label='Crafting level progress'
				>
					<div className='cr-xpfill' style={{ width: `${progress * 100}%` }} />
					<span className='cr-xptext'>{Math.floor(progress * 100)}%</span>
				</div>

				<div className='cr-body'>
					<div className='cr-left'>
						<div className='cr-kinds' role='group' aria-label='Recipe categories'>
							{KINDS.map((kind) => (
								<button
									key={kind}
									className='px-btn px-btn-sm'
									data-active={!hidden.has(kind)}
									aria-pressed={!hidden.has(kind)}
									onClick={() => toggleKind(kind)}
								>
									{KIND_LABELS[kind]}
								</button>
							))}
						</div>
						<div className='cr-grid'>
							{shown.map((recipe) => (
								<RecipeTile key={recipe.id} recipe={recipe} have={have} selected={recipe.id === selected.id} onSelect={() => setSelectedId(recipe.id)} />
							))}
						</div>
					</div>
					<RecipeDetail key={selected.id} recipe={selected} have={have} />
				</div>

				<QueuePanel />
				<p className='cr-foot'>Crafting level never resets. New recipes unlock as it grows.</p>
			</div>
		</div>
	);
};

export default CraftingOverlay;
