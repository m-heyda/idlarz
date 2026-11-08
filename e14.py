p='tests/combat/beltStats.test.ts'
s=open(p,encoding='utf-8').read()
s=s.replace("import { winChanceOf } from './winChanceHelper';\n","import { estimateWin } from '../../src/lib/offline/winChance';\n")
s=s.replace("	assert.ok(winChanceOf(belt('G9')) >= winChanceOf(STARTER_EQUIPMENT), 'stronger potions never make the estimate worse');",
"""	const chance = (equipment: Equipment) => {
		const p = playerProfile(core(equipment));
		return estimateWin(p, p.maxHp * 0.5, 'thistleBoar', 9, [{ healHp: 90, count: 5 }]);
	};
	assert.ok(chance(belt('G9')).surviveSec > chance(STARTER_EQUIPMENT).surviveSec, 'stronger and faster potions last longer');""")
open(p,'w',encoding='utf-8').write(s)
