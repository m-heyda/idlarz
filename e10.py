def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('src/lib/offline/winChance.ts',[("	const potionHp = potions.reduce((sum, potion) => sum + potion.healHp * Math.min(potion.count, Math.floor(killSec / COMBAT.potionCooldownSec) + 1), 0);",
"	const cooldown = p.potionCooldownSec ?? COMBAT.potionCooldownSec;\n	const potionHp = potions.reduce((sum, potion) => sum + potion.healHp * (p.potionPower ?? 1) * Math.min(potion.count, Math.floor(killSec / cooldown) + 1), 0);")])
edit('src/lib/effectiveStats.ts',[("import { gearEconomy, xpGainPct }","import { potionCooldownSec, potionPower, potionSlotCount } from '@/lib/beltEffects';\nimport { gearEconomy, xpGainPct }"),
("		goldFind: gear.goldFind,\n","		goldFind: gear.goldFind,\n		/** The shared potion cooldown in seconds, what a potion heals as a multiplier, the potion hotkey slots and the bag slots a belt adds */\n		potionCooldownSec: potionCooldownSec(equipment),\n		potionPower: potionPower(equipment),\n		potionSlots: potionSlotCount(equipment),\n		bagSlots: gearBagSlots(equipment),\n")])
