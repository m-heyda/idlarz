import audioManager from '@/utils/audioManager';

/** The fanfare plays once per burst: several tiers earned by one request each get a notice but share one sound. */
const FANFARE_GAP_MS = 1200;
let lastFanfareAt = 0;

/** Plays the fanfare unless it played a moment ago. Returns whether it played. */
export const playAchievementFanfare = (now = Date.now()): boolean => {
	if (now - lastFanfareAt < FANFARE_GAP_MS) return false;
	lastFanfareAt = now;
	audioManager.playSound('fanfare');
	return true;
};
