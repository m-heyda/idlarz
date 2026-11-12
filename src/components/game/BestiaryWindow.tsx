import React from 'react';
import { ComingSoon } from '../../../packages/design-system/src/components/composites';
import { pixelIconSrc } from '@/config/pixelIcons';
import GameWindow from './GameWindow';

/** The Bestiary: a coming-soon window for now (the monsters you have met, their drops and kills). The kill counts it will show are already kept by the server (`useBestiaryStore`). */
const BestiaryWindow: React.FC = () => (
	<GameWindow id='bestiary' title='Bestiary' width={560} height={420}>
		<ComingSoon
			title='Bestiary'
			icon={pixelIconSrc('menu_bestiary')}
			text='Every monster you meet will be written down here: what it is, where it lives, what it drops and how many you have beaten.'
		/>
	</GameWindow>
);

export default BestiaryWindow;
