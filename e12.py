def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('src/catalog/items/ladder.ts',[
("""	// The belt's own stats (potion cooldown and power, potion slots, bag slots; IDL-138) are not in the stats pipeline yet, so a belt
	// carries the plain defence of an accessory until they land (IDL-139 follow-up).
	belt: { armor: 0.29, maxHp: 0.57 },
""","""	belt: {}, // a belt has no per-index stats: see BELT_STATS
"""),
("/** The off hand of a caster:","""/**
 * The belt stat ladder (IDL-138, IDL-142), by grade: every belt shortens the potion cooldown (the floor is 4 s, a 50 % cut), heals more per
 * potion, and from the middle grades gives potion hotkey slots and bag slots. Fixed numbers, not scaled by the strength index: a belt is a
 * tool, and its worth is the same at any item level. The set belts sit at the cooldown floor and let the set bonuses carry the rest.
 * PLACEHOLDERS (TODO tune in R2 C5). Normal affixes still roll on top.
 */
const BELT_STATS: Record<Grade, ItemStats> = {
	G1: { potionCooldownPct: 5 },
	G2: { potionCooldownPct: 8 },
	G3: { potionCooldownPct: 12, potionPowerPct: 4, bagSlots: 1 },
	G4: { potionCooldownPct: 16, potionPowerPct: 6, bagSlots: 1 },
	G5: { potionCooldownPct: 20, potionPowerPct: 8, bagSlots: 1, potionSlots: 1 },
	G6: { potionCooldownPct: 25, potionPowerPct: 10, bagSlots: 2, potionSlots: 1 },
	G7: { potionCooldownPct: 32, potionPowerPct: 14, bagSlots: 2, potionSlots: 1 },
	G8: { potionCooldownPct: 40, potionPowerPct: 18, bagSlots: 2, potionSlots: 1 },
	G9: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S1: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S2: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S3: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
};

/** The off hand of a caster:"""),
("	for (const slot of ARMOUR_SLOTS) cell(grade, slot, ARMOUR_NAMES[slot][g], slot, scaled(forGrade(grade, SLOT_STATS[slot]), index, tier));",
"""	for (const slot of ARMOUR_SLOTS) {
		const stats = slot === 'belt' ? BELT_STATS[grade] : scaled(forGrade(grade, SLOT_STATS[slot]), index, tier);
		cell(grade, slot, ARMOUR_NAMES[slot][g], slot, stats);
	}"""),
])
