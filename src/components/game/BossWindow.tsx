import React from 'react';
import { ComingSoon } from '../../../packages/design-system/src/components/composites';
import { pixelIconSrc } from '@/config/pixelIcons';
import GameWindow from './GameWindow';

/**
 * The Boss window: a coming-soon placeholder for the world boss (the end-game goal: every player offers a material such as a corruption core to summon one boss together, then all fight it for a shared super reward).
 * Nothing is kept or sent yet; the design comes later.
 */
const BossWindow: React.FC = () => (
	<GameWindow id='boss' title='Boss' width={560} height={420}>
		<ComingSoon title='World boss' icon={pixelIconSrc('menu_boss')} text='World boss spawns coming soon.' />
	</GameWindow>
);

export default BossWindow;
