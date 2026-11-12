import React from 'react';
import { ComingSoon } from '../../../packages/design-system/src/components/composites';
import { pixelIconSrc } from '@/config/pixelIcons';
import GameWindow from './GameWindow';

/** The Rankings: a coming-soon window for now (the best heroes of the realm). Every name there will be drawn with `NickName`, the badge, the title and the admin mark (`AdminMark`), from the profile's own columns (`profiles.badge_id`, `title_id`, `name_color`, `is_admin`). */
const RankingsWindow: React.FC = () => (
	<GameWindow id='rankings' title='Rankings' width={560} height={420}>
		<ComingSoon
			title='Rankings'
			icon={pixelIconSrc('menu_rankings')}
			text='The mightiest heroes of the realm will be listed here, with their colours, badges and titles. Nothing to show yet.'
		/>
	</GameWindow>
);

export default RankingsWindow;
