p='tests/combat/beltStats.test.ts'
s=open(p,encoding='utf-8').read()
a="// The belt stats (IDL-138/139)"
s=s.replace(a,"// Auto-battle's win-chance gate is tested in winChance.test.ts; here the player fights whatever is put in front of them (each test file is its own process).\n(COMBAT.auto as { minWinChance: number }).minWinChance = 0;\n\n"+a,1)
open(p,'w',encoding='utf-8').write(s)
