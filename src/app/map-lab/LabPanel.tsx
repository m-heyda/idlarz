'use client';

import React, { useRef, useState } from 'react';
import { BIOMES, CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { biomeColor } from '@/config/biomePalette';
import PixelIcon from '@/components/game/PixelIcon';
import CombatPreview, { WIP_MONSTERS } from './CombatPreview';
import { castleLevelOf } from '@/lib/castleWard';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import { PAINT_BIOMES, useLabStore, type LabPreset, type LabTool } from '@/stores/labStore';
import { getTile } from '@/utils/world';

const TOOLS: { id: LabTool; label: string; hint: string }[] = [
	{ id: 'pan', label: 'Pan', hint: 'Drag to move the map' },
	{ id: 'paint', label: 'Paint', hint: 'Hold and drag to paint the biome (also over existing land)' },
	{ id: 'extend', label: 'Extend', hint: 'Hold and drag outwards to grow new land only, never overwriting' },
	{ id: 'erase', label: 'Erase', hint: 'Hold and drag to remove land (the castle stays)' },
	{ id: 'chest', label: 'Chest', hint: 'Hold and drag to place chests' },
	{ id: 'unchest', label: 'Unchest', hint: 'Hold and drag to remove chests' },
	{ id: 'rat', label: 'Rat', hint: 'Click a tile to place a rat (again to remove)' },
	{ id: 'ratKing', label: 'Rat King', hint: 'Click a tile to place the boss' },
	{ id: 'dismiss', label: 'Dismiss', hint: 'Click a monster to remove it' },
];

const PRESETS: { id: LabPreset; label: string }[] = [
	{ id: 'start', label: 'Start ring' },
	{ id: 'rolled60', label: 'Rolled 60' },
	{ id: 'rolled400', label: 'Rolled 400' },
	{ id: 'showcase', label: 'Every biome' },
	{ id: 'landmarks', label: 'Landmarks (6x6)' },
];

const WIP_BIOMES = [...new Set(WIP_MONSTERS.map((m) => m.biomes[0] as string))];

const btn =
	'px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/15 text-xs text-left disabled:opacity-40 disabled:hover:bg-white/5';
const active = 'border-amber-300 bg-amber-300/20';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
	<section className='space-y-1.5'>
		<h3 className='text-[10px] uppercase tracking-wider text-white/50'>{title}</h3>
		{children}
	</section>
);

const LabPanel: React.FC = () => {
	const lab = useLabStore();
	const ambient = useSettingsStore((s) => s.ambientLife);
	const showMinimap = useUiStore((s) => s.showMinimap);
	const [open, setOpen] = useState(true);
	const [count, setCount] = useState(5);
	const [wipId, setWipId] = useState(WIP_MONSTERS[0].id);
	const [previewOpen, setPreviewOpen] = useState(false);
		const [message, setMessage] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);
	const castleLevel = castleLevelOf(lab.tiles);
	const tool = TOOLS.find((t) => t.id === lab.tool);
	const castlePresent = !!getTile(lab.tiles, CASTLE_X, CASTLE_Y);

	const download = () => {
		const url = URL.createObjectURL(new Blob([lab.exportJson()], { type: 'application/json' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'map-lab.json';
		a.click();
		URL.revokeObjectURL(url);
	};

	const upload = async (file: File | undefined) => {
		if (!file) return;
		setMessage(lab.importJson(await file.text()) ? 'Imported' : 'Not a map-lab file');
	};

	return (
		<aside
			className='fixed left-3 top-3 z-50 w-64 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-lg border border-white/15 bg-black/80 p-3 text-white backdrop-blur space-y-3'
			onContextMenu={(e) => e.stopPropagation()}>
			<header className='flex items-center justify-between'>
				<h2 className='text-sm font-bold'>Map lab</h2>
				<button className={btn} onClick={() => setOpen(!open)} aria-expanded={open}>
					{open ? 'Hide' : 'Show'}
				</button>
			</header>
			{open && (
				<>
					<p className='text-[11px] text-white/60'>
						Simulated map, nothing is saved or sent. Hold the main button to draw; the map holds still while you do (middle button pans).
					</p>

					<Section title='Tool'>
						<div className='grid grid-cols-3 gap-1'>
							{TOOLS.map((t) => (
								<button key={t.id} className={`${btn} ${lab.tool === t.id ? active : ''}`} title={t.hint} onClick={() => lab.setTool(t.id)}>
									{t.label}
								</button>
							))}
						</div>
						<p className='text-[11px] text-white/60'>{tool?.hint}</p>
					</Section>

					<Section title='Biome'>
						<div className='grid grid-cols-3 gap-1'>
							{PAINT_BIOMES.map((b) => (
								<button key={b} className={`${btn} flex items-center gap-1 ${lab.biome === b ? active : ''}`} onClick={() => lab.setBiome(b)}>
									<i className='inline-block h-3 w-3 shrink-0 rounded-sm border border-black/50' style={{ background: biomeColor(b) }} />
									<span className='truncate'>{BIOMES[b]?.label ?? b}</span>
								</button>
							))}
						</div>
					</Section>

					<Section title='Brush'>
						<div className='flex gap-1'>
							{[1, 3, 5].map((n) => (
								<button key={n} className={`${btn} flex-1 text-center ${lab.brush === n ? active : ''}`} onClick={() => lab.setBrush(n)}>
									{n}x{n}
								</button>
							))}
						</div>
						<button className={`${btn} w-full`} onClick={lab.extendRing}>
							Extend land by one ring ({BIOMES[lab.biome]?.label ?? lab.biome})
						</button>
					</Section>

					<Section title='Spawn'>
							<select value={wipId} onChange={(e) => setWipId(e.target.value)} className='w-full rounded bg-white/10 px-1 py-1 text-xs'>
									{WIP_BIOMES.map((biome) => (
										<optgroup key={biome} label={BIOMES[biome]?.label ?? biome}>
											{WIP_MONSTERS.filter((m) => m.biomes[0] === biome).map((m) => (
												<option key={m.id} value={m.id} className='text-black'>
													{m.grade === 'boss' ? '☠ ' : ''}
													{m.label}
												</option>
											))}
										</optgroup>
									))}
								</select>
							<div className='flex gap-1'>
								<button className={`${btn} flex-1`} title='Place WIP monsters (art only) on their own biome' onClick={() => lab.spawnWip(wipId, count)}>
									Spawn WIP
								</button>
								<button className={`${btn} flex items-center gap-1`} title='Combat preview: the game&apos;s combat window with this monster, facing left' aria-label='Combat preview' onClick={() => setPreviewOpen(true)}>
									<PixelIcon name='item_iron_sword' alt='' scale={0.5} />
									Fight
								</button>
							</div>
						<label className='flex items-center gap-2 text-xs'>
							Count
							<input
								type='number'
								min={1}
								max={200}
								value={count}
								onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
								className='w-16 rounded bg-white/10 px-1 py-0.5'
							/>
						</label>
						<div className='grid grid-cols-2 gap-1'>
							<button className={btn} onClick={() => lab.spawnChests(count)}>
								Chests
							</button>
							<button className={btn} onClick={() => lab.spawnMonsters('rat', count)}>
								Rats
							</button>
							<button className={btn} onClick={() => lab.spawnMonsters('ratKing', 1)}>
								Rat King
							</button>
							<button className={btn} onClick={lab.clearChests}>
								Clear chests
							</button>
							<button className={btn} onClick={lab.clearMonsters}>
								Clear monsters
							</button>
						</div>
						<label className='flex items-center gap-2 text-xs'>
							Placed monster level
							<input
								type='number'
								min={1}
								value={lab.monsterLevel}
								onChange={(e) => lab.setMonsterLevel(Number(e.target.value))}
								className='w-16 rounded bg-white/10 px-1 py-0.5'
							/>
						</label>
						<label className='flex items-center gap-2 text-xs'>
							<input type='checkbox' checked={lab.lucky} onChange={(e) => lab.setLucky(e.target.checked)} /> Lucky (golden)
						</label>
					</Section>

					<Section title='Castle'>
						<label className='flex items-center gap-2 text-xs'>
							Level {castleLevel}
							<input
								type='range'
								min={1}
								max={CASTLE_UPGRADE.maxLevel}
								value={castleLevel}
								disabled={!castlePresent}
								onChange={(e) => lab.setCastleLevel(Number(e.target.value))}
								className='flex-1'
							/>
						</label>
					</Section>

					<Section title='World'>
						<label className='flex items-center gap-2 text-xs'>
							Seed
							<input
								type='number'
								value={lab.seed}
								onChange={(e) => lab.setSeed(Number(e.target.value))}
								className='w-24 rounded bg-white/10 px-1 py-0.5'
							/>
						</label>
						<div className='grid grid-cols-2 gap-1'>
							{PRESETS.map((p) => (
								<button key={p.id} className={btn} onClick={() => lab.reset(p.id)}>
									{p.label}
								</button>
							))}
						</div>
						<div className='grid grid-cols-3 gap-1'>
							<button className={btn} onClick={lab.undo} disabled={!lab.history.length} title='Ctrl+Z'>
								Undo
							</button>
							<button className={btn} onClick={download}>
								Export
							</button>
							<button className={btn} onClick={() => fileRef.current?.click()}>
								Import
							</button>
						</div>
						<input ref={fileRef} type='file' accept='application/json' hidden onChange={(e) => void upload(e.target.files?.[0])} />
						{message && <p className='text-[11px] text-amber-200'>{message}</p>}
					</Section>

					<Section title='View'>
						<label className='flex items-center gap-2 text-xs'>
							<input type='checkbox' checked={ambient} onChange={(e) => useSettingsStore.getState().setAmbientLife(e.target.checked)} /> Ambient life
						</label>
						<label className='flex items-center gap-2 text-xs'>
							<input type='checkbox' checked={showMinimap} onChange={(e) => useUiStore.setState({ showMinimap: e.target.checked })} /> Minimap
						</label>
					</Section>
				</>
			)}
			{previewOpen && <CombatPreview initialId={wipId} onClose={() => setPreviewOpen(false)} />}
		</aside>
	);
};

export default LabPanel;
