/** The server-only secret that seals rolls (the LOOT_SECRET variable). Empty when it is not set up: the offline and reward routes then answer 503. */
export const lootSecret = (): string => process.env.LOOT_SECRET ?? '';

export const lootConfigured = (): boolean => lootSecret().length >= 16;
