import { BASELINE_EPOCH, GAME_EPOCH } from '@/config/epoch';

/** The build's environment, read once (`process.env.X` is written out literally so Next inlines it into the browser bundle). */
export interface GuideEnv {
	epoch: number;
	/** `process.env.NODE_ENV`: 'development' on localhost, 'production' on every deployed build (previews too) */
	nodeEnv?: string;
	/** `NEXT_PUBLIC_VERCEL_ENV` (`next.config.ts` copies `VERCEL_ENV` into it): 'production', 'preview' or 'development' on Vercel, empty elsewhere */
	vercelEnv?: string;
	/** `NEXT_PUBLIC_GUIDE` */
	flag?: string;
}

const currentEnv = (): GuideEnv => ({
	epoch: GAME_EPOCH,
	nodeEnv: process.env.NODE_ENV,
	vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
	flag: process.env.NEXT_PUBLIC_GUIDE,
});

/**
 * Whether the tutorial is on for the new-chapter economy: bundles are not paid and achievements are not settled before it (`settleAchievements`). Only the release flip (`GAME_EPOCH` raised, IDL-253) or
 * `NEXT_PUBLIC_GUIDE=on` switches it on; a deployed build never has it before the flip.
 */
export const guideLiveFor = (env: GuideEnv): boolean => env.epoch > BASELINE_EPOCH || env.flag === 'on';

/**
 * Whether Brother Alder is **shown** (the bubbles, the focus layer, the journal tab). That is `guideLiveFor`, and also every build that is not the production site: localhost
 * (`next dev`, `NODE_ENV` is not 'production') and Vercel previews (`NEXT_PUBLIC_VERCEL_ENV` is 'preview' or 'development'), so the tutorial can be tried without touching `GAME_EPOCH`.
 * The production deployment shows it only after the flip. `NEXT_PUBLIC_GUIDE=on` forces it on anywhere (set it in `.env.local` or the host's environment); `NEXT_PUBLIC_GUIDE=off` is not special.
 *
 * @category Progression/Guided tutorial
 * @order 1
 */
export const guideVisibleFor = (env: GuideEnv): boolean =>
	guideLiveFor(env) || (env.nodeEnv !== undefined && env.nodeEnv !== 'production') || (!!env.vercelEnv && env.vercelEnv !== 'production');

export const guideLive = (): boolean => guideLiveFor(currentEnv());

export const guideVisible = (): boolean => guideVisibleFor(currentEnv());
