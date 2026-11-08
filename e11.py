def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('src/components/game/overlays/CombatWidget.tsx',[
("	const bag = useGameStore((state) => state.bag);\n","	const bag = useGameStore((state) => state.bag);\n	const equipment = useGameStore((state) => state.equipment);\n"),
("""	// Up to three potion stacks from the bag, with hotkeys 1-3
	const potions = bag
		.map((slot, index) => ({ slot, index }))
		.filter(({ slot }) => slot && 'id' in slot && ITEM_CATALOG[slot.id]?.consumable)
		.slice(0, 3);""","""	// Up to three potion stacks from the bag (more with a belt), the first three on hotkeys 1-3 and the belt's on 6, 7, 8...
	const potions = bag
		.map((slot, index) => ({ slot, index }))
		.filter(({ slot }) => slot && 'id' in slot && ITEM_CATALOG[slot.id]?.consumable)
		.slice(0, potionSlotCount(equipment));"""),
("""			const potion = potions[n - 1]?.slot;
			if (n <= 3 && potion && 'id' in potion) requestPotion(potion.id);
			else if (n >= 4 && n < 4 + SKILL_IDS.length) requestSkill(SKILL_IDS[n - 4]);""","""			const potion = potions[potionIndexOfKey(n)]?.slot;
			if (potionIndexOfKey(n) >= 0 && potion && 'id' in potion) requestPotion(potion.id);
			else if (n >= 4 && n < 4 + SKILL_IDS.length) requestSkill(SKILL_IDS[n - 4]);"""),
("	}, [potions, requestPotion, requestSkill]);","	}, [potions, requestPotion, requestSkill]);"),
])
