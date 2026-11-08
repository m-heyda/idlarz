def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('src/lib/offline/inventory.ts',[("import { addDrop, equipFromBag, gearOf,","import { addDrop, equipFromBag, gearBagSlots, gearOf,")])
edit('src/lib/sanitizeSave.ts',[("import { starterBag } from '@/lib/inventory';","import { gearBagSlots, starterBag } from '@/lib/inventory';")])
edit('src/lib/offline/fightTypes.ts',[("	/** What a Heal restores */\n	heal: number;\n}","	/** What a Heal restores */\n	heal: number;\n	/** The shared potion cooldown in seconds and the multiplier on what a potion heals, from the worn belt (absent in a fight frozen before belts: the base cooldown, 1) */\n	potionCooldownSec?: number;\n	potionPower?: number;\n}")])
edit('src/lib/offline/profile.ts',[("import { healAmount } from '@/lib/skills';","import { potionCooldownSec, potionPower } from '@/lib/beltEffects';\nimport { healAmount } from '@/lib/skills';"),
("		heal: healAmount(stats, equipment),\n	};","		heal: healAmount(stats, equipment),\n		potionCooldownSec: potionCooldownSec(equipment),\n		potionPower: potionPower(equipment),\n	};")])
edit('src/lib/offline/fightSteps.ts',[
("""	const healHp = ITEM_CATALOG[id]?.consumable?.healHp;
	if (!healHp || stockOf(ctx, id) < 1 || c.hp >= maxHpNow(ctx) - EPS) return false;""","""	const baseHeal = ITEM_CATALOG[id]?.consumable?.healHp;
	if (!baseHeal || stockOf(ctx, id) < 1 || c.hp >= maxHpNow(ctx) - EPS) return false;
	const profile = c.fight ? c.fight.profile : ctx.profileNow; // the belt worn when the fight began
	const healHp = baseHeal * (profile.potionPower ?? 1);"""),
("	if (c.fight) c.cd.potion = COMBAT.potionCooldownSec;","	if (c.fight) c.cd.potion = profile.potionCooldownSec ?? COMBAT.potionCooldownSec;"),
("ITEM_CATALOG[a].consumable!.healHp! - ITEM_CATALOG[b].consumable!.healHp!)","ITEM_CATALOG[a].consumable!.healHp! - ITEM_CATALOG[b].consumable!.healHp!)"),
])
