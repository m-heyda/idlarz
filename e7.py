def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)

edit('src/catalog/stats.ts',[
("	lifeLeech: { label: 'Life Leech', unit: '%', decimals: 1, levelShare: 0.3 }, // % of the damage dealt returned as HP (capped by STAT_RULES.lifeLeechCap)\n",
"""	lifeLeech: { label: 'Life Leech', unit: '%', decimals: 1, levelShare: 0.3 }, // % of the damage dealt returned as HP (capped by STAT_RULES.lifeLeechCap)

	// ---- belt stats (IDL-138/139): only belts carry them, none follows the item level (a belt is a fixed tool, not a stat stick) --------
	potionCooldownPct: { label: 'Potion Cooldown', unit: '% shorter', levelShare: 0 }, // % off the shared potion cooldown (the cooldown never goes under COMBAT.potionCooldownMinSec)
	potionPowerPct: { label: 'Potion Healing', unit: '%', levelShare: 0 }, // % more HP from every potion
	potionSlots: { label: 'Potion Slots', integer: true, levelShare: 0 }, // potion hotkey slots added to the base three
	bagSlots: { label: 'Bag Slots', integer: true, levelShare: 0 }, // bag slots added to the bag while the belt is worn
"""),
("	lifeLeech: 'combat',\n","	lifeLeech: 'combat',\n	potionCooldownPct: 'defense',\n	potionPowerPct: 'defense',\n	potionSlots: 'defense',\n	bagSlots: 'economy',\n"),
("	lifeLeech: [0.5, 1, 1.5, 2, 3],\n","	lifeLeech: [0.5, 1, 1.5, 2, 3],\n	potionCooldownPct: [5, 10, 18, 30, 50],\n	potionPowerPct: [4, 8, 12, 18, 24],\n	potionSlots: [1, 2, 3, 4, 5],\n	bagSlots: [1, 2, 3, 4, 5],\n"),
])
edit('src/config/combatConfig.ts',[("	potionCooldownSec: 8, // shared cooldown between potions inside a fight\n","	potionCooldownSec: 8, // shared cooldown between potions inside a fight\n	potionCooldownMinSec: 4, // the floor belts can bring it down to\n	potionSlots: 3, // potion hotkey slots before any belt\n")])
