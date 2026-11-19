const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..','..');
const OUT=process.argv[2]||path.join(__dirname,'pixel-asset-inventory.html');
const m=JSON.parse(fs.readFileSync(ROOT+'/docs/assets/manifest.json','utf8'));
const keep=e=>!/\(sheet\)/.test(e.subcategory)&&(e.category==='resources'||(e.category==='potions'&&/junk/.test(e.src))||(e.category==='unsorted'&&/\/__reuse\/(drops|food|gems|glassware|junk|legendary|materials|misc|ores|potions|tools|valuables)\//.test(e.src))||(e.category==='map-details'&&/mineable|minerals/.test(e.subcategory))||(e.category==='ui'&&e.subcategory==='crafting'));
const list=m.filter(keep);
const ING={blood:1,clay:1,dried_herbs:1,orange_mushrooms:1,grapes:1,hollow_log:1,glowberry:2,horn_dark:2,copper_ore:2,ember_coal:2,obsidian:2,geode:2,dark_shard:2,dark_potion:2,moon:3,fire_drop:3,emerald_star:3,heart_gem:4,silver_ore:2,gold_ore:3,crystal:3};
const RARBYT={1:'common',2:'uncommon',3:'rare',4:'epic'};
const ROCKS={copper_ore:['common','uncommon','rare','legendary'],ember_coal:['common','uncommon','rare','epic','legendary'],silver_ore:['uncommon','rare','epic','legendary'],gold_ore:['rare','epic','legendary'],crystal:['epic','legendary']};
const slugOf=e=>e.name.replace(/^art_junk_/,'').replace(/^resource_spare_/,'').replace(/^reuse_[a-z]+?_/,'').replace(/^resource_/,'').replace(/^res_/,'').replace(/-/g,'_');
// [category,tier,rarity,grade,ores,chest,purpose]
const P={
 reuse_ores_coal:['base-resource','T0','common','',[],false,'Alternative coal picture; the live coal icon is already used.'],
 reuse_ores_copper_ore:['craft-raw','T2','uncommon','G1',['common','uncommon','rare','legendary'],false,'Copper ore: smelt with coal into copper ingots (bronze grade).'],
 reuse_ores_iron_ore:['craft-raw','T3','uncommon','G3',['uncommon','rare'],false,'Iron ore: smelt into iron ingots (iron/steel grade).'],
 reuse_ores_silver_ore:['craft-raw','T2','uncommon','G4',['uncommon','rare','epic','legendary'],false,'Silver ore: silver ingots for jewelry and holy gear.'],
 reuse_ores_gold_ore:['craft-raw','T3','rare','G5',['rare','epic','legendary'],false,'Gold ore: gold ingots for jewelry and legendary components.'],
 reuse_ores_dark_ore:['craft-raw','T3','rare','G6',['epic','legendary'],false,'Dark ore: obsidian-grade ingots, the key ore of the Obsidian tier.'],
 reuse_materials_iron_ingot:['craft-refined','T1','uncommon','G3',[],false,'Smelted iron ore: base for iron grade recipes.'],
 reuse_materials_gold_ingot:['craft-refined','T2','rare','G5',[],false,'Smelted gold ore: jewelry and legendary recipe input.'],
 reuse_materials_hot_ingot:['craft-refined','T1','common','',[],false,'Ingot straight from the furnace (in-progress craft icon).'],
 reuse_materials_logs:['base-resource','T0','common','',[],false,'Alternative wood picture; planks are made from it.'],
 reuse_materials_sawdust:['junk','T0','common','',[],false,'Plank byproduct: sell as junk or use as fuel filler.'],
 reuse_materials_stone_block:['craft-refined','T1','common','',[],false,'Cut stone: building upgrades and shields.'],
 reuse_materials_cloth_bolt:['craft-refined','T1','uncommon','G2',[],false,'Woven cloth from wool: cloth armor tier.'],
 reuse_materials_gold_thread:['craft-refined','T2','rare','G5',[],false,'Gold thread for robes and legendary cloaks.'],
 reuse_materials_rope_coil:['craft-refined','T1','common','',[],false,'Rope from hide/fiber: bows, crossbows, traps.'],
 reuse_materials_raw_hide:['craft-raw','T1','common','G1',[],false,'Untanned hide: tan with salt into leather.'],
 reuse_materials_herb_bundle:['craft-raw','T1','common','',[],false,'Gathered herbs: potion base.'],
 reuse_materials_ash_bowl:['craft-raw','T1','common','',[],false,'Wood ash: glass and soap, enchant prep.'],
 reuse_materials_dust_bottle:['craft-raw','T2','uncommon','',[],true,'Bottled dust: enchanting powder.'],
 reuse_materials_blue_powder:['craft-raw','T2','uncommon','',[],true,'Mana powder: enchant and potion reagent.'],
 reuse_materials_yellow_powder:['craft-raw','T2','uncommon','',[],true,'Sulphur-like powder: fire potions and smelting flux.'],
 reuse_gems_amethyst:['gem','T2','uncommon','',['epic','legendary'],true,'Cut gem for jewelry (violet).'],
 reuse_gems_diamond:['gem','T4','epic','',['legendary'],true,'Top gem: finest jewelry, legendary components.'],
 reuse_gems_emerald:['gem','T3','rare','',['epic','legendary'],true,'Cut gem for jewelry (green).'],
 reuse_gems_ruby:['gem','T3','rare','',['epic','legendary'],true,'Cut gem for jewelry (red), fire-ward rings.'],
 reuse_gems_sapphire:['gem','T3','rare','',['epic','legendary'],true,'Cut gem for jewelry (blue), mana rings.'],
 reuse_gems_topaz:['gem','T2','uncommon','',['epic','legendary'],true,'Cut gem for jewelry (yellow).'],
 reuse_drops_beetle:['craft-raw','T1','common','',[],false,'Monster part: chitin for light armor.'],
 reuse_drops_black_feather:['craft-raw','T2','uncommon','',[],false,'Monster part: arrow fletching, dark cloaks.'],
 reuse_drops_dark_spine:['craft-raw','T2','uncommon','',[],false,'Monster part: spears and venom arrows.'],
 reuse_drops_fang:['craft-raw','T1','common','',[],false,'Monster part: daggers and charms.'],
 reuse_drops_fur_pelt:['craft-raw','T1','common','',[],false,'Monster part: cold-weather armor (tundra).'],
 reuse_drops_goblin_ear:['junk','T0','common','',[],false,'Goblin trophy: sells for gold (bounty item if quests come).'],
 reuse_drops_lizard_hide:['craft-raw','T2','uncommon','',[],false,'Monster part: jungle leather.'],
 reuse_drops_thread_spool:['craft-raw','T1','common','',[],false,'Thread: cloth and leather stitching.'],
 reuse_drops_wool:['base-resource','T1','common','',[],false,'Duplicate of the live wool icon.'],
 reuse_glassware_cracked_flask:['junk','T0','common','',[],false,'Broken flask: junk, or melts down into glass.'],
 reuse_glassware_empty_flask:['craft-refined','T1','common','',[],false,'Empty flask: potion crafting container.'],
 reuse_glassware_glass_jar:['craft-refined','T1','common','',[],false,'Glass jar: preserves, honey, herb extracts.'],
 reuse_glassware_mushroom_jar:['craft-refined','T2','uncommon','',[],false,'Spore jar: fungal reagent container.'],
 reuse_glassware_rope_bottle:['craft-refined','T1','common','',[],false,'Rope-wrapped bottle: sturdy potion container.'],
 reuse_glassware_test_tube:['craft-refined','T2','uncommon','',[],false,'Alchemy tube: enchanted crafts.'],
 reuse_valuables_crystal_ball:['craft-special','T4','epic','G8',[],true,'Legendary component: scrying focus for staves and tomes.'],
 reuse_valuables_dagger:['valuable','T0','uncommon','',[],true,'Ornate dagger: vendor valuable (sells high).'],
 reuse_valuables_goblet:['valuable','T0','uncommon','',[],true,'Gold goblet: vendor valuable.'],
 reuse_valuables_gold_amulet:['valuable','T0','rare','',[],true,'Gold amulet: vendor valuable or jewelry base.'],
 reuse_valuables_gold_ring:['valuable','T0','rare','',[],true,'Gold ring: vendor valuable or jewelry base.'],
 reuse_valuables_golden_egg:['craft-special','T4','epic','G7',[],true,'Legendary component: golden egg (ties to the rooster upgrade).'],
 reuse_valuables_phoenix_feather:['craft-special','T4','legendary','G9',[],true,'Legendary component for the fire legendaries (Cindercrescent Glaive, Cinderflight Bow).'],
 reuse_valuables_rune_stone:['craft-special','T4','epic','G8',[],true,'Legendary component for Runeforged Titanhammer and Voidrune Blade.'],
 reuse_valuables_sealed_scroll:['craft-special','T3','rare','G7',[],true,'Legendary component: sealed recipe scroll that unlocks a legendary craft.'],
 reuse_valuables_silver_key:['craft-special','T3','rare','',[],true,'Key to a locked chest or vault.'],
 reuse_valuables_silver_medal:['craft-special','T3','rare','',[],false,'War Medal stand-in: legendary craft currency (docs/plan/17).'],
 reuse_valuables_spellbook:['craft-special','T3','rare','G6',[],true,'Component for tomes and off-hand legendaries.'],
 reuse_tools_pickaxe:['tool','T0','common','',[],false,'Mining tool: upgrade for rock click damage.'],
 reuse_tools_hammer:['tool','T0','common','',[],false,'Smithing tool: crafting station.'],
 reuse_tools_crucible:['tool','T1','uncommon','',[],false,'Smelting station: ores into ingots.'],
 reuse_tools_mortar:['tool','T1','common','',[],false,'Alchemy station: powders and potions.'],
 reuse_tools_hourglass:['tool','T2','uncommon','',[],false,'Timer item: speed up a craft or upgrade.'],
 reuse_tools_lantern:['tool','T1','common','',[],false,'Lantern: night-vision buff or dungeon light.'],
 reuse_tools_torch:['tool','T0','common','',[],false,'Torch: consumable light.'],
 reuse_tools_bear_trap:['tool','T1','common','',[],false,'Trap: hunting for meat and hide.'],
 reuse_tools_shackles:['junk','T0','common','',[],false,'Shackles: junk or boss-drop trophy.'],
 reuse_tools_rope:['craft-refined','T1','common','',[],false,'Rope: duplicate idea of rope coil.'],
 reuse_tools_arrows:['craft-refined','T1','common','G1',[],false,'Arrow bundle: ammo / bow crafting input.'],
 reuse_tools_bow:['other','T0','common','',[],false,'A weapon picture, not a material.'],
 reuse_tools_hand_axe:['tool','T0','common','',[],false,'Woodcutting tool: upgrade for wood income.'],
 reuse_tools_iron_sword:['other','T0','common','',[],false,'A weapon picture, not a material.'],
 reuse_food_honey_jar:['craft-raw','T2','uncommon','',[],false,'Honey: planned T2 orchard good (potions, polish).'],
 reuse_potions_oil_bottle:['craft-refined','T1','common','',[],false,'Oil: weapon polish, lamps, fire potion base.'],
 reuse_potions_ointment_tin:['consumable','T1','common','',[],false,'Ointment: heal over time.'],
 reuse_junk_wire_coil:['craft-refined','T1','common','',[],false,'Wire: jewelry and trap crafting.'],
 reuse_junk_nails:['craft-refined','T1','common','',[],false,'Nails: planks and shields.'],
 reuse_junk_cog_wheel:['craft-special','T3','rare','',[],true,'Mechanism part: crossbow / legendary component.'],
 reuse_junk_old_key:['craft-special','T2','uncommon','',[],true,'Old key: chest-opener item.'],
 reuse_junk_candle:['craft-refined','T1','common','',[],false,'Candle: wax and light, enchanting ritual input.'],
 reuse_junk_parchment:['craft-refined','T1','common','',[],false,'Parchment: scrolls and recipes.'],
 reuse_junk_burlap:['craft-refined','T1','common','',[],false,'Burlap: cheap cloth tier.'],
 reuse_junk_yarn_ball:['craft-refined','T1','common','',[],false,'Yarn: cloth tier.'],
 reuse_junk_bone_awl:['tool','T0','common','',[],false,'Awl: leatherworking tool.'],
};
const FB={
 reuse_junk:['junk','T0','common','',[],false,'Plain vendor junk (sell for gold).'],
 reuse_potions:['consumable','T1','common','',[],true,'Potion picture: another consumable variant.'],
 reuse_food:['food','T0','common','',[],false,'Food item: farm or feast buffs, vendor food.'],
 reuse_misc:['other','T0','common','',[],false,'Unnamed cut-out, needs a look.'],
 reuse_legendary:['craft-special','T4','legendary','G9',[],true,'Unnamed legendary cut-out, needs a look.'],
};
// decisions.json = the "Copy full config" or "Copy edited config" output of the page, saved here: its values replace the proposals below
let DEC={};try{DEC=JSON.parse(fs.readFileSync(path.join(__dirname,'decisions.json'),'utf8')).items||{}}catch(e){}
const ents=[],imgs=new Map();
for(const e of list){
  const file=ROOT+'/public'+e.src;
  if(!fs.existsSync(file)){console.error('missing',file);continue}
  const buf=fs.readFileSync(file);const h=crypto.createHash('md5').update(buf).digest('hex').slice(0,12);
  if(!imgs.has(h))imgs.set(h,'data:image/png;base64,'+buf.toString('base64'));
  const slug=slugOf(e);
  const st=e.status==='used'?'used':e.status==='planned'?'planned':'unused';
  const src=e.src.replace('/pixel/','');
  const group=e.category==='map-details'?(e.subcategory.includes('mineable')?'rocks':'minerals'):src.startsWith('__reuse/')?src.split('/')[1]:src.startsWith('items/')?'items/'+src.split('/')[1]:src.split('/')[0];
  const rg=e.name.match(/^reuse_[a-z]+/);
  let d;
  if(P[e.name])d=P[e.name];
  else if(e.name.startsWith('art_junk_')||e.name.startsWith('resource_spare_')){
    const t=ING[slug],live=e.name.startsWith('art_');
    if(t)d=['craft-raw','T'+t,RARBYT[t],'',ROCKS[slug]||[],t>=3,'Crafting ingredient '+(live?'(live: drops into the crafting bag, no recipe yet).':'(spare copy of a live ingredient picture).')];
    else d=['junk','T0','common','',[],false,live?'Live junk item: sold to the merchant.':'Spare copy of a junk picture.'];
  }
  else if(group==='rocks')d=['map-object','','','',[],false,'Clickable rock on the map ('+slug.replace('rock_','')+' tier).'];
  else if(group==='minerals')d=['map-object','','','',[],false,'Crystal cluster map decoration; could become a mining-node sprite or gem-drop node.'];
  else if(e.category==='resources'){
    const sub=e.subcategory;
    if(sub==='currency'||/^(diamond|gold|legacy)/.test(sub))d=['currency','','','',[],false,'Currency icon.'];
    else if(sub.startsWith('comp'))d=['craft-refined','T1','common','',[],false,'Crafting component used by the recipe UI.'];
    else if(sub==='animal')d=['other','','','',[],false,'Farm animal icon, not a material.'];
    else if(/^t3/.test(sub)||sub==='res')d=['extract','T3','uncommon','',[],false,'Biome extract (T3) for crafting.'];
    else if(/^t2/.test(sub))d=['base-resource','T2','uncommon','',[],false,'Biome good (T2) for crafting.'];
    else d=['base-resource',/t1|hide|eggs|milk|wool/.test(sub)?'T1':'T0','common','',[],false,'Live base resource.'];
  }
  else if(e.category==='ui')d=['other','','','',[],false,'Crafting station art (Blacksmith).'];
  else d=FB[rg&&rg[0]]||['other','','','',[],false,'Needs a look.'];
  if(e.name==='res_iron'||e.name==='resource_iron_ore')d=['extract','T3','uncommon','G3',['uncommon','rare'],false,'Iron ore (Hills extract), planned T3.'];
  const [cat,tier,rar,grade,ores,chest,purpose]=d;
  const label=group==='minerals'?path.basename(src,'.png').replace(/_/g,' ').replace(/ +/g,' '):slug.replace(/_/g,' ').replace(/^sf.*/,'unnamed '+slug.slice(3,9));
  ents.push({id:e.name,label,src,img:h,size:e.size,group,status:st,usedBy:e.usedBy.filter(Boolean).slice(0,3),slug,
    def:{status:st,category:cat,tier,grade,rarity:rar,ores,chest,add:st==='used'||st==='planned',del:false,ok:false,purpose}});
  const dd=DEC[e.name];
  if(dd){const d0=ents[ents.length-1].def;
    for(const [k,v] of [['status',dd.status],['category',dd.category],['tier',dd.tier],['grade',dd.grade],['rarity',dd.rarity],['add',dd.addToGame],['chest',dd.inChest],['del',dd.delete],['ok',dd.reviewed],['purpose',dd.purpose]])if(v!==undefined)d0[k]=v===null?'':v;
    if(dd.foundInOres!==undefined)d0.ores=Array.isArray(dd.foundInOres)?dd.foundInOres:[];}
}
const bySlug={};for(const x of ents)(bySlug[x.slug]=bySlug[x.slug]||[]).push(x);
for(const x of ents){if(x.group==='minerals')continue;const o=(bySlug[x.slug]||[]).filter(y=>y!==x&&y.group!=='minerals');if(o.length)x.also=o.map(y=>y.src);}
// the used pictures are reviewed (decisions.json); the page lists planned and unused ones. INCLUDE_USED=1 adds them back.
if(!process.env.INCLUDE_USED)for(let i=ents.length-1;i>=0;i--)if(ents[i].def.status==='used')ents.splice(i,1);
const tpl=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
const html=tpl.replace('/*DATA*/',()=>'const ITEMS='+JSON.stringify(ents)+';const IMGS='+JSON.stringify(Object.fromEntries([...imgs].filter(([k])=>ents.some(e=>e.img===k))))+';');
fs.writeFileSync(OUT,html);
const cnt={};for(const x of ents)cnt[x.status]=(cnt[x.status]||0)+1;
console.log(ents.length,imgs.size,(html.length/1e6).toFixed(2)+'MB',JSON.stringify(cnt));
