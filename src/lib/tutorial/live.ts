import { BASELINE_EPOCH, GAME_EPOCH } from '@/config/epoch';

/**
 * Whether Brother Alder is on at all. The tutorial ships dark with the new chapter: until `GAME_EPOCH` is raised (the release flip, IDL-253) nobody sees it, so accounts that are
 * playing the old chapter get no bubbles. To try it on a build before the flip, set `NEXT_PUBLIC_GUIDE=on`.
 *
 * @category Progression/Guided tutorial
 * @order 1
 */
export const guideLive = (): boolean => GAME_EPOCH > BASELINE_EPOCH || process.env.NEXT_PUBLIC_GUIDE === 'on';
