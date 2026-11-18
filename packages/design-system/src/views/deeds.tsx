import React, { useMemo, useState } from 'react';
import { Badge, Button, DiamondLevel, Inset, Panel, ProgressBar } from '../components/primitives';
import { compact } from '../logic';
import { Dropdown } from './bestiary';

// The Hall of Deeds content (IDL-321): a summary bar (deeds done, deed points with the next milestone, the bonus, Claim all), categories + a tag filter + sorting, the deeds with tier diamonds, progress and Claim, a paper detail
// with the tier ladder, and the deed point milestones. Data in, callbacks out: the game feeds it from the server's report (`src/components/game/DeedsWindow.tsx`, built by `src/lib/deedsView.ts`), Storybook from fixtures.
// It lays itself out from its own width (a CSS container, `ds-bst`, shared with the Bestiary).

const INK = '#2b1d0e';
const MUTED = '#8a7a5a';
const GREEN = '#2f6b2f';

export type TierState = 'locked' | 'earned' | 'claimed';

export interface DeedTierVM {
	/** Achievement id of the tier */
	id: string;
	goal: number;
	gems: number;
	points: number;
	/** What the tier asks, as a sentence ("Defeat 500 monsters.") */
	text: string;
	state: TierState;
	/** What the tier unlocks besides gems and points ("Title: Slayer", "Avatar: Architect"), empty for most */
	unlocks: string[];
}

export interface DeedVM {
	id: string;
	name: string;
	desc: string;
	category: string;
	tags: readonly string[];
	icon: string;
	/** The deed has no picture of its own yet: its stand-in is drawn as a medal silhouette */
	placeholder: boolean;
	lore: string;
	how: string;
	/** The player's number towards the next tier's goal */
	cur: number;
	tiers: DeedTierVM[];
}

export interface MilestoneVM {
	id: string;
	points: number;
	gems: number;
	/** "+1% kill gold" */
	bonus: string;
	state: 'locked' | 'ready' | 'claimed';
}

export interface DeedsPanelProps {
	deeds: DeedVM[];
	milestones: MilestoneVM[];
	/** Deed points of the claimed tiers */
	points: number;
	totalPoints: number;
	/** What the claimed milestones give, as the line under "Bonus from deeds" */
	bonusText: string;
	/** Categories in the order of the list: id, label */
	categories: readonly [string, string][];
	/** Tiers and milestones waiting for Claim */
	claimable: number;
	busy: boolean;
	onClaim: (id: string) => void;
	onClaimAll: () => void;
}

type Sort = 'ready' | 'close' | 'category';
const SORTS: readonly [Sort, string][] = [
	['ready', 'Claimable first'],
	['close', 'Closest to next tier'],
	['category', 'By category'],
];

const claimedCount = (d: DeedVM) => d.tiers.filter((t) => t.state === 'claimed').length;
const readyTiers = (d: DeedVM) => d.tiers.filter((t) => t.state === 'earned');
const isComplete = (d: DeedVM) => d.tiers.every((t) => t.state === 'claimed');
const nextTier = (d: DeedVM) => d.tiers.find((t) => t.state === 'locked');
/** 0 to 1 towards the next tier (1 when every tier is earned) */
const closeness = (d: DeedVM): number => {
	const i = d.tiers.findIndex((t) => t.state === 'locked');
	if (i < 0) return 1;
	const from = i > 0 ? d.tiers[i - 1].goal : 0;
	return Math.max(0, Math.min(1, (d.cur - from) / Math.max(1, d.tiers[i].goal - from)));
};

/** The list shows points only; the gems are the extra the Claim button pays */
const pointsText = (t: Pick<DeedTierVM, 'points'>) => `${t.points} pts`;
const ladderText = (t: Pick<DeedTierVM, 'gems' | 'points'>) => `${t.points} pts · +${t.gems} gems on claim`;

/** The picture of a deed; a deed without art yet shows a medal silhouette */
const DeedIcon: React.FC<{ deed: DeedVM }> = ({ deed }) => <img src={deed.icon} alt='' data-placeholder={deed.placeholder || undefined} />;

export const DeedsPanel: React.FC<DeedsPanelProps> = ({
	deeds,
	milestones,
	points,
	totalPoints,
	bonusText,
	categories,
	claimable,
	busy,
	onClaim,
	onClaimAll,
}) => {
	const [cat, setCat] = useState('all');
	const [tag, setTag] = useState('all');
	const [sort, setSort] = useState<Sort>('ready');
	const [sel, setSel] = useState(deeds[0]?.id);
	const tags = useMemo(() => [...new Set(deeds.flatMap((d) => d.tags))].sort(), [deeds]);
	const order = useMemo(() => new Map(categories.map(([id], i) => [id, i])), [categories]);
	const done = deeds.filter(isComplete).length;
	const next = milestones.find((m) => m.state === 'locked');
	const before = [...milestones].reverse().find((m) => m.points <= points)?.points ?? 0;
	const inMilestones = cat === 'milestones';
	const list = useMemo(() => {
		const rows = deeds.map((d, i) => ({ d, i })).filter(({ d }) => (cat === 'all' || cat === d.category) && (tag === 'all' || d.tags.includes(tag)));
		rows.sort((a, b) => {
			if (sort === 'category') return (order.get(a.d.category) ?? 99) - (order.get(b.d.category) ?? 99) || a.i - b.i;
			if (sort === 'close') return Number(isComplete(a.d)) - Number(isComplete(b.d)) || closeness(b.d) - closeness(a.d) || a.i - b.i;
			return (
				readyTiers(b.d).length - readyTiers(a.d).length || Number(isComplete(a.d)) - Number(isComplete(b.d)) || closeness(b.d) - closeness(a.d) || a.i - b.i
			);
		});
		return rows.map((r) => r.d);
	}, [deeds, cat, tag, sort, order]);
	const d = deeds.find((x) => x.id === sel) ?? list[0] ?? deeds[0];
	return (
		<div className='ds-bst ds-dh'>
			<div className='ds-sumbar ds-bst-bar'>
				<div className='ds-sum-progress'>
					<span className='ds-dim'>Deeds completed</span>
					<ProgressBar value={done} max={Math.max(1, deeds.length)} tone='gold' label={`${done} / ${deeds.length}`} height={16} />
				</div>
				<div className='ds-sum-progress'>
					<span className='ds-dim'>
						Deed points <b className='ds-dh-pts'>{points.toLocaleString('en-US')}</b> / {totalPoints.toLocaleString('en-US')}
					</span>
					<ProgressBar
						value={next ? points - before : 1}
						max={next ? Math.max(1, next.points - before) : 1}
						tone='xp'
						label={next ? `Next milestone: ${next.points} pts` : 'All milestones reached'}
						height={16}
					/>
				</div>
				<div className='ds-sum-cell'>
					<span className='ds-dim'>Bonus from deeds</span>
					<b className='ds-good'>{bonusText}</b>
				</div>
				<div className='ds-sum-claim'>
					<span className='ds-dim'>Ready to claim</span>
					{claimable > 0 ? <Badge count={claimable} /> : null}
					<Button tone='gold' disabled={busy || claimable === 0} className={claimable ? 'ds-collect-glow' : undefined} onClick={onClaimAll}>
						Claim all
					</Button>
				</div>
			</div>
			<div className='ds-dh-main'>
				<Inset className='ds-cats'>
					{[['all', 'All deeds'] as const, ...categories].map(([id, label]) => (
						<button key={id} type='button' data-active={cat === id} onClick={() => setCat(id)}>
							<span>{label}</span>
							<span className='ds-dim'>{id === 'all' ? deeds.length : deeds.filter((x) => x.category === id).length}</span>
						</button>
					))}
					<button type='button' data-active={inMilestones} onClick={() => setCat('milestones')}>
						<span>Milestones</span>
						<span className='ds-dim'>{milestones.filter((m) => m.state === 'ready').length || milestones.length}</span>
					</button>
				</Inset>
				{inMilestones ? (
					<Panel parchment className='ds-ledger ds-detail ds-dh-ms'>
						<div className='ds-paper-title'>Deed milestones</div>
						<p className='ds-paper-text'>
							Every point total you reach pays gems and a small permanent bonus on kill rewards. A milestone opens when your claimed deed points reach it.
						</p>
						{milestones.map((m) => (
							<div className='ds-dh-mrow' key={m.id} data-state={m.state}>
								<b>{m.points.toLocaleString('en-US')} pts</b>
								<span>
									{m.gems} gems · {m.bonus}
								</span>
								{m.state === 'ready' ? (
									<Button tone='gold' size='sm' disabled={busy} onClick={() => onClaim(m.id)}>
										Claim
									</Button>
								) : (
									<em>{m.state === 'claimed' ? 'Claimed' : `${Math.max(0, m.points - points).toLocaleString('en-US')} to go`}</em>
								)}
							</div>
						))}
					</Panel>
				) : (
					<>
						<div className='ds-dh-listcol'>
							<div className='ds-dh-tools'>
								<span className='ds-dim'>{list.length} deeds</span>
								<span className='ds-dh-filters'>
									<Dropdown label='Sort' value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS} />
									<Dropdown label='Tag' value={tag} onChange={setTag} options={[['all', 'Any tag'], ...tags.map((t): [string, string] => [t, t])]} />
								</span>
							</div>
							<div className='ds-gloss-list ds-dh-list'>
								{list.length === 0 ? <div className='ds-dim ds-dh-empty'>No deeds match.</div> : null}
								{list.map((x) => {
									const all = isComplete(x);
									const n = nextTier(x);
									const waiting = readyTiers(x);
									const i = x.tiers.findIndex((t) => t.state === 'locked');
									const from = i > 0 ? x.tiers[i - 1].goal : 0;
									return (
										<div
											key={x.id}
											role='button'
											tabIndex={0}
											className='ds-deed'
											data-active={x.id === d?.id}
											data-done={all}
											data-ready={waiting.length > 0 || undefined}
											onClick={() => setSel(x.id)}
											onKeyDown={(e) => e.key === 'Enter' && setSel(x.id)}
										>
											<span className='ds-deed-icon'>
												<DeedIcon deed={x} />
											</span>
											<span className='ds-deed-main'>
												<span className='ds-deed-name'>
													{x.name}
													<DiamondLevel level={claimedCount(x)} max={x.tiers.length} small />
												</span>
												<span className='ds-deed-desc'>{n?.text ?? x.desc}</span>
												<ProgressBar
													value={!n ? 1 : Math.max(0, x.cur - from)}
													max={!n ? 1 : Math.max(1, n.goal - from)}
													tone='gold'
													height={14}
													label={!n ? (all ? 'Complete' : 'All earned') : `${compact(Math.min(x.cur, n.goal))} / ${compact(n.goal)}`}
												/>
											</span>
											<span className='ds-deed-side'>
												<b>{waiting.length > 0 ? pointsText(waiting[0]) : n ? pointsText(n) : 'All claimed'}</b>
												{waiting.length > 0 ? (
													<Button
														tone='gold'
														disabled={busy}
														onClick={(e) => {
															e.stopPropagation();
															onClaim(waiting[0].id);
														}}
													>
														{waiting.length > 1 ? `Claim (${waiting.length})` : 'Claim'}
													</Button>
												) : null}
											</span>
										</div>
									);
								})}
							</div>
						</div>
						{d ? (
							<Panel parchment className='ds-ledger ds-detail'>
								<div className='ds-detail-head'>
									<span className='ds-deed-icon ds-deed-icon-lg'>
										<DeedIcon deed={d} />
									</span>
									<div>
										<div className='ds-paper-title'>{d.name}</div>
										<div className='ds-paper-sub'>
											{categories.find((c) => c[0] === d.category)?.[1]} ·{' '}
											{isComplete(d) ? 'All tiers claimed' : `${claimedCount(d)} of ${d.tiers.length} tiers claimed`}
										</div>
										<DiamondLevel level={claimedCount(d)} max={d.tiers.length} />
									</div>
								</div>
								<p className='ds-paper-text'>{d.lore}</p>
								<div className='ds-capi'>Tiers</div>
								{d.tiers.map((t, i) => (
									<div className='ds-dh-tier' key={t.id} data-state={t.state}>
										<i className='ds-gem ds-dh-diamond' data-state={t.state === 'locked' ? 'off' : 'on'} data-waiting={t.state === 'earned' || undefined} />
										<span className='ds-dh-tier-main' style={{ color: t.state === 'claimed' ? GREEN : t.state === 'earned' ? INK : MUTED }}>
											<b>
												Tier {i + 1} · {compact(t.goal)}
											</b>
											<small>{ladderText(t)}</small>
										</span>
										{t.state === 'earned' ? (
											<Button tone='gold' size='sm' disabled={busy} onClick={() => onClaim(t.id)}>
												Claim
											</Button>
										) : (
											<em>{t.state === 'claimed' ? 'Claimed' : ''}</em>
										)}
									</div>
								))}
								{d.tiers.some((t) => t.unlocks.length > 0) ? (
									<>
										<div className='ds-capi' style={{ marginTop: 12 }}>
											Special unlocks
										</div>
										{d.tiers.flatMap((t, i) =>
											t.unlocks.map((u) => (
												<div className='ds-dh-unlockrow' key={t.id + u} data-state={t.state}>
													<span>{u}</span>
													<em>Tier {i + 1}</em>
												</div>
											)),
										)}
									</>
								) : null}
								<div className='ds-capi' style={{ marginTop: 12 }}>
									How to progress
								</div>
								<p className='ds-paper-text'>{d.how}</p>
								<div className='ds-tags'>
									{d.tags.map((t) => (
										<span key={t} style={{ background: '#6a4b24' }}>
											{t}
										</span>
									))}
								</div>
							</Panel>
						) : null}
					</>
				)}
			</div>
		</div>
	);
};
