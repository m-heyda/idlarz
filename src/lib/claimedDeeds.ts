// A leaf module so the game store can read the claimed deeds without importing the achievement store (which imports the game store: that would be an import cycle). The achievement store registers itself here when it loads.

let source: () => readonly string[] = () => [];

/** Called once by the achievement store: where the claimed deed ids are read from */
export const setClaimedDeedsSource = (read: () => readonly string[]): void => {
	source = read;
};

/** The deed ids the server says the player has claimed (empty until the achievement store has loaded) */
export const claimedDeedsNow = (): readonly string[] => source();
