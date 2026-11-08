def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('tests/audit/combat.test.ts',[("	spellPower: 0.4,\n};","	spellPower: 0.4,\n	// belt stats follow no item level\n	potionCooldownPct: 0,\n	potionPowerPct: 0,\n	potionSlots: 0,\n	bagSlots: 0,\n};"),
("const INTEGER_STATS = new Set(['damage', 'armor', 'maxHp', 'luck', 'maxMana']);","const INTEGER_STATS = new Set(['damage', 'armor', 'maxHp', 'luck', 'maxMana', 'potionSlots', 'bagSlots']);")])
edit('tests/loot/belt.test.ts',[("""	withBelt.equipment = { ...STARTER_EQUIPMENT, belt: rare('obsidian_belt') };
	const result = sanitizeSave(withBelt);""","""	withBelt.equipment = { ...STARTER_EQUIPMENT, belt: rare('obsidian_belt') };
	const unsized = sanitizeSave(withBelt);
	assert.equal(unsized.ok, false, 'the belt gives 2 bag slots: the bag of an unbelted size is wrong');
	withBelt.bag = [...withBelt.bag, null, null];
	const result = sanitizeSave(withBelt);""")])
