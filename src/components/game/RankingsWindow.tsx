import React, { useEffect, useState } from 'react';
import { AdminMark, ComingSoon, NickName } from '../../../packages/design-system/src/components/composites';
import { Tabs } from '../../../packages/design-system/src/components/primitives';
import { nickColorValue } from '@/config/nickColors';
import { pixelIconSrc } from '@/config/pixelIcons';
import { notify } from '@/lib/notices';
import { RANKING_BOARDS, type RankingBoardId, type RankingRow } from '@/lib/rankings';
import { useRankings } from '@/lib/rankingsQuery';
import AvatarArt from './AvatarArt';
import GameWindow from './GameWindow';

const SOON_TEXT: Partial<Record<RankingBoardId, string>> = {
	quests: 'Who has finished the most quests. Quests are not in the game yet, so there is nothing to rank.',
	deeds: 'Who has earned the most Deed points. Every deed will get a point value first, then this board opens.',
};

/** The number of a row: level and crafting level read "Lv 87", the rest is a plain count */
const valueText = (board: RankingBoardId, value: number): string => (board === 'level' || board === 'crafting' ? `Lv ${value}` : value.toLocaleString('en-US'));

/** ▲ 3 / ▼ 2 / – / new: how the place changed since the last daily rebuild */
const Move: React.FC<{ row: RankingRow }> = ({ row }) => {
	const { dir, by } = row.move;
	if (dir === 'new')
		return (
			<span className='ds-rank-move' data-dir='new'>
				new
			</span>
		);
	if (dir === 'same')
		return (
			<span className='ds-rank-move' data-dir='same'>
				–
			</span>
		);
	return (
		<span className='ds-rank-move' data-dir={dir} title={dir === 'up' ? `Up ${by} since yesterday` : `Down ${by} since yesterday`}>
			{dir === 'up' ? '▲' : '▼'} {by}
		</span>
	);
};

const Row: React.FC<{ row: RankingRow; board: RankingBoardId }> = ({ row, board }) => (
	<li className='ds-listrow ds-listrow-line ds-rank-row' data-me={row.me} data-top={row.rank <= 3 ? row.rank : undefined}>
		<span className='ds-rank-pos'>{row.rank}</span>
		<AvatarArt id={row.avatarId} playerClass={row.playerClass} className='ds-rank-avatar' scale={1.4} />
		<span className='ds-rank-who'>
			<span className='ds-rank-name'>
				<NickName color={nickColorValue(row.nameColor)}>{row.name}</NickName>
				{row.admin && <AdminMark />}
			</span>
			{row.title && <span className='ds-rank-title'>{row.title}</span>}
		</span>
		{row.badge ? (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={`/pixel/new_assets/achievements/${row.badge}.png`}
				alt={row.badgeName ?? ''}
				title={row.badgeName ?? undefined}
				width={40}
				height={40}
				className='pixelated'
			/>
		) : (
			<span className='ds-rank-nobadge' />
		)}
		<span className='ds-rank-value'>
			{valueText(board, row.value)}
			{row.paragon > 0 && (
				<span className='ds-rank-paragon' title={`Paragon ${row.paragon}`}>
					✦ {row.paragon}
				</span>
			)}
		</span>
		<Move row={row} />
	</li>
);

/** Placeholder rows with the size of real ones, so the list does not jump when a board arrives */
const SkeletonRows: React.FC = () => (
	<ul className='ds-rank-list' aria-busy='true'>
		{Array.from({ length: 8 }, (_, i) => (
			<li key={i} className='ds-listrow ds-listrow-line ds-rank-row'>
				<span className='sk ds-rank-sk-pos' />
				<span className='sk ds-rank-sk-art' />
				<span className='sk ds-rank-sk-name' />
			</li>
		))}
	</ul>
);

const Board: React.FC<{ board: RankingBoardId }> = ({ board }) => {
	const { data, isError, isPending } = useRankings(board);
	useEffect(() => {
		if (isError) notify('The rankings could not be loaded. Try again in a moment.', 'error');
	}, [isError]);
	if (isPending) return <SkeletonRows />;
	if (isError || !data) return <p className='ds-dim ds-rank-empty'>The rankings are not available right now.</p>;
	if (data.rows.length === 0) return <p className='ds-dim ds-rank-empty'>Nobody is ranked here yet.</p>;
	return (
		<>
			<ul className='ds-rank-list'>
				{data.rows.map((row) => (
					<Row key={row.rank + row.name} row={row} board={board} />
				))}
			</ul>
			{data.mine && (
				<ul className='ds-rank-list ds-rank-mine'>
					<Row row={data.mine} board={board} />
				</ul>
			)}
			<p className='ds-dim ds-rank-foot'>
				Rebuilt once a day{data.refreshedAt ? `, last on ${new Date(data.refreshedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.
				Ties go to whoever got there first.
			</p>
		</>
	);
};

/**
 * The Rankings: one tab per board (`RANKING_BOARDS`), a zebra list of the best heroes with their avatar, coloured name, admin mark, title and badge, the board's number and the move since the last daily rebuild. Quests and Deeds are
 * "coming soon" tabs. The data is `GET /api/rankings`, cached per board by `useRankings`.
 */
const RankingsWindow: React.FC = () => {
	const [tab, setTab] = useState<RankingBoardId>('level');
	const info = RANKING_BOARDS.find((entry) => entry.id === tab);
	return (
		<GameWindow
			id='rankings'
			title='Rankings'
			width={620}
			height={560}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as RankingBoardId)}
					items={RANKING_BOARDS.map((entry) => ({ id: entry.id, label: entry.label, title: entry.soon ? 'Coming soon' : undefined }))}
				/>
			}
		>
			{info?.soon ? (
				<ComingSoon title={info.label} icon={pixelIconSrc('menu_rankings')} text={SOON_TEXT[tab] ?? 'Nothing to show yet.'} />
			) : (
				<Board board={tab} />
			)}
		</GameWindow>
	);
};

export default RankingsWindow;
