import React from 'react';
import { ComingSoon } from '../../../packages/design-system/src/components/composites';
import { pixelIconSrc } from '@/config/pixelIcons';
import GameWindow from './GameWindow';

/**
 * The Boss window: a coming-soon placeholder for the world boss (the end-game goal: every player offers a material such as a corruption core to summon one boss together, then all fight it for a shared super reward).
 * The treasure hall (`pixel/bg/boss_hall.webp`) fills the window under a black overlay, so it reads as a dimmed backdrop for the "coming soon" card. Nothing is kept or sent yet; the design comes later.
 */
const BossWindow: React.FC = () => (
	<GameWindow id='boss' title='Boss' width={640} height={480} flush>
		<div
			style={{
				position: 'relative',
				width: '100%',
				height: '100%',
				minHeight: 0,
				display: 'grid',
				placeItems: 'center',
				backgroundImage: "url('/pixel/bg/boss_hall.webp')",
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				imageRendering: 'pixelated',
			}}
		>
			<div aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.5)' }} />
			<div style={{ position: 'relative' }}>
				<ComingSoon
					title='World boss'
					icon={pixelIconSrc('menu_boss')}
					text='World boss spawns coming soon.'
					// a card with room around the text and a darker plate behind it, so it reads over the busy picture
					style={{ height: 'auto', minHeight: 0, padding: '32px 52px', background: 'rgba(0, 0, 0, 0.78)', border: '1px solid rgba(240, 210, 122, 0.35)' }}
				/>
			</div>
		</div>
	</GameWindow>
);

export default BossWindow;
