import React, { useEffect, useState } from 'react';
import { COMPONENTS, RECIPES, type Recipe } from '@/catalog/recipes';
import { ITEM_CATALOG } from '@/catalog';
import { craftBlock, craftLevelOf, craftLimit, craftNeeds, craftTimeSec, craftXpToNext, finishedOf } from '@/lib/crafting';
import { RECIPE_BY_ID } from '@/catalog/recipes';
import { selectQueue, selectStock, useCraftStore } from '@/stores/craftStore';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber, formatTime } from '@/utils/formatters';
import ResourceIcon from '../ResourceIcon';
import PixelIcon from '../PixelIcon';
import { itemIconName } from '../itemUi';

const outputName = (recipe: Recipe) => ('item' in recipe.output ? ITEM_CATALOG[recipe.output.item].name : COMPONENTS[recipe.output.component].name);

/** One recipe: what it makes, what it costs for the chosen quantity (red = missing), its lock, and the craft button. */
const RecipeRow: React.FC<{ recipe: Recipe; count: number; craftLevel: number }> = ({ recipe, count, craftLevel }) => {
	const resources = useGameStore((state) => state.resources);
	const stock = useCraftStore(selectStock);
	const busy = useCraftStore((state) => state.busy);
	const slotsFull = useCraftStore(selectQueue).length >= craftLimit('craftQueueSlots') && !!recipe.timeSec;
	const craftItem = useCraftStore((state) => state.craftItem);
	const showToast = useUiStore((state) => state.showToast);
	const needs = craftNeeds(recipe, count);
	const block = craftBlock(recipe, count, { craftLevel, resources, stock });
	const locked = craftLevel < recipe.unlock;
	const perCraft = craftTimeSec(recipe);
	const held = 'component' in recipe.output ? (stock[recipe.output.component] ?? 0) : null;

	return (
		<div className={`px-card ${locked ? 'opacity-60' : ''}`}>
			<div className='flex justify-between items-baseline gap-2'>
				<h3 className='font-semibold text-sm text-[#ecdcb4] inline-flex items-center gap-2'>
					{'item' in recipe.output && <PixelIcon name={itemIconName(ITEM_CATALOG[recipe.output.item])} alt='' />}
					{outputName(recipe)}
					{recipe.output.qty > 1 ? ` x${recipe.output.qty}` : ''}
					<span className='ml-2 text-xs text-[#a89878]'>{recipe.kind}</span>
				</h3>
				<span className='text-xs text-orange-300'>+{formatNumber(recipe.xp * count)} XP</span>
			</div>
			{perCraft > 0 && (
				<p className='text-xs text-[#a89878]'>
					{formatTime(perCraft)} each, {formatTime(perCraft * count)} for {count}
				</p>
			)}
			{held !== null && <p className='text-xs text-[#a89878]'>You hold {held}</p>}
			{locked ? (
				<p className='text-xs text-[#ff8a6a] mt-1'>Unlocks at crafting level {recipe.unlock}</p>
			) : (
				<div className='flex flex-wrap items-center justify-between gap-2 mt-2 text-sm'>
					<span className='inline-flex flex-wrap items-center gap-x-3 gap-y-1'>
						{needs.resources.map((n) => (
							<span key={n.key} className={`inline-flex items-center gap-1 ${resources[n.key] >= n.qty ? 'text-green-400' : 'text-red-400'}`}>
								<ResourceIcon resource={n.key} />
								{formatNumber(n.qty)}
							</span>
						))}
						{needs.components.map((n) => (
							<span key={n.id} className={(stock[n.id] ?? 0) >= n.qty ? 'text-green-400' : 'text-red-400'}>
								{n.qty} x {COMPONENTS[n.id].name}
							</span>
						))}
					</span>
					<button
						className='px-btn px-btn-sm'
						disabled={!!block || busy || slotsFull}
						aria-label={`${recipe.timeSec ? 'Queue' : 'Craft'} ${count} ${outputName(recipe)}`}
						onClick={() => void craftItem(recipe.id, count).then((text) => showToast(text))}
					>
						{recipe.timeSec ? 'Queue' : 'Craft'}
					</button>
				</div>
			)}
		</div>
	);
};

/** The server's clock in ms, ticking once a second (the queue is drawn on it; nothing here decides anything, the server derives the finished count itself). */
const useServerNow = (): number => {
	const offset = useCraftStore((state) => state.clockOffsetMs);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);
	return now + offset;
};

/** The running batches: progress, a claim button for what is finished, a cancel button for the rest. */
const QueuePanel: React.FC = () => {
	const queue = useCraftStore(selectQueue);
	const busy = useCraftStore((state) => state.busy);
	const claim = useCraftStore((state) => state.claim);
	const cancel = useCraftStore((state) => state.cancel);
	const showToast = useUiStore((state) => state.showToast);
	const now = useServerNow();
	if (queue.length === 0) return null;
	return (
		<div className='space-y-2'>
			{queue.map((entry, slot) => {
				const recipe = RECIPE_BY_ID[entry.recipeId];
				const done = finishedOf(entry, now);
				const left = (entry.count - done) * entry.timeSec - Math.max(0, now - entry.startedAt - done * entry.timeSec * 1000) / 1000;
				const stalled = done < entry.count && now - entry.startedAt >= craftLimit('craftOfflineHours') * 3_600_000;
				return (
					<div key={`${entry.recipeId}-${entry.startedAt}`} className='px-card'>
						<div className='flex justify-between items-baseline gap-2 text-sm'>
							<span className='font-semibold text-[#ecdcb4]'>{recipe ? recipe.name : entry.recipeId}</span>
							<span className='tabular-nums text-yellow-400'>
								{formatNumber(done)} / {formatNumber(entry.count)} ready
							</span>
						</div>
						<div className='hero-xp' style={{ '--pct': (done / entry.count) * 100 } as React.CSSProperties}>
							<div className='hero-xp-text'>{stalled ? 'Waiting for you' : done >= entry.count ? 'Done' : formatTime(Math.max(0, left))}</div>
						</div>
						<div className='flex justify-end gap-2 mt-2'>
							<button className='px-btn px-btn-sm' disabled={busy} aria-label='Cancel batch' onClick={() => void cancel(slot).then((text) => showToast(text))}>
								Cancel
							</button>
							<button
								className='px-btn px-btn-sm'
								disabled={busy || done < 1}
								aria-label='Collect finished crafts'
								onClick={() => void claim(slot).then((text) => showToast(text))}
							>
								Collect {done > 0 ? formatNumber(done) : ''}
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
};

const CraftingOverlay: React.FC = () => {
	const craft = useCraftStore((state) => state.craft);
	const refresh = useCraftStore((state) => state.refresh);
	const [count, setCount] = useState(1);
	useEffect(() => void refresh(), [refresh]);

	const xp = craft?.xp ?? 0;
	const { level, progress } = craftLevelOf(xp);
	const next = craftXpToNext(level);

	return (
		<div className='space-y-3 text-white'>
			<div>
				<div className='flex justify-between text-sm'>
					<span className='text-orange-300'>Crafting level {level}</span>
					<span className='text-[#a89878] tabular-nums'>
						{Number.isFinite(next) ? `${formatNumber(Math.floor(next * progress))} / ${formatNumber(next)} XP` : 'MAX'}
					</span>
				</div>
				<div className='hero-xp' style={{ '--pct': progress * 100 } as React.CSSProperties}>
					<div className='hero-xp-text'>{Math.floor(progress * 100)}%</div>
				</div>
			</div>

			<div className='flex items-center gap-2 text-sm'>
				<span className='text-[#d8c8a0]'>Quantity</span>
				<input
					type='range'
					min={1}
					max={craftLimit('craftBatchCap')}
					value={count}
					onChange={(event) => setCount(Number(event.target.value))}
					aria-label='Quantity'
				/>
				<span className='tabular-nums w-10 text-yellow-400'>{count}</span>
			</div>

			<QueuePanel />

			<div className='space-y-2'>
				{RECIPES.map((recipe) => (
					<RecipeRow key={recipe.id} recipe={recipe} count={count} craftLevel={level} />
				))}
			</div>
			<p className='text-xs text-[#7a6a52]'>Crafting level never resets. New recipes unlock as it grows.</p>
		</div>
	);
};

export default CraftingOverlay;
