#!/usr/bin/env python3
"""Gera o catálogo SRD normalizado de Aethra a partir do JSON PocketDM.

Uso:
    python tools/build_monster_catalog.py caminho/pocketdm_monstros.json

Sem argumento, usa data/source/pocketdm_monstros_srd.json.
"""
import json, math, re, os, sys, statistics
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'data/source/pocketdm_monstros_srd.json'
DATA_SRC = ROOT / 'data/source'
DATA_GEN = ROOT / 'data/generated'
JS_DATA = ROOT / 'js/data'
for p in [DATA_SRC, DATA_GEN, JS_DATA]:
    p.mkdir(parents=True, exist_ok=True)

if not SOURCE.exists():
    raise SystemExit(f'Arquivo fonte não encontrado: {SOURCE}')

with SOURCE.open(encoding='utf-8') as f:
    raw = json.load(f)

srd=[m for m in raw['monsters'] if m.get('is_srd') is True]

TRANSLATIONS={
'Giant Rat':'Rato Gigante','Wolf':'Lobo','Boar':'Javali','Bandit':'Bandido','Black Bear':'Urso Negro',
'Blink Dog':'Cão Teleportador','Cultist':'Cultista','Skeleton':'Esqueleto','Zombie':'Zumbi','Ghoul':'Carniçal',
'Giant Spider':'Aranha Gigante','Goblin':'Goblin','Goblin Boss':'Chefe Goblin','Orc':'Orc','Hobgoblin':'Hobgoblin',
'Bugbear':'Bugbear','Owlbear':'Urso-Coruja','Dire Wolf':'Lobo Atroz','Wight':'Inumano','Mummy':'Múmia',
'Werewolf':'Lobisomem','Troll':'Troll','Wraith':'Espectro Negro','Wyvern':'Wyvern','Young Green Dragon':'Dragão Verde Jovem',
'Hydra':'Hidra','Vampire':'Vampiro','Lich':'Lich','Ancient Black Dragon':'Dragão Negro Ancião','Tarrasque':'Tarrasque',
'Giant Fire Beetle':'Besouro de Fogo Gigante','Giant Centipede':'Centopeia Gigante','Giant Badger':'Texugo Gigante',
'Giant Frog':'Sapo Gigante','Giant Lizard':'Lagarto Gigante','Poisonous Snake':'Serpente Venenosa',
'Giant Wolf Spider':'Aranha-Lobo Gigante','Acolyte':'Acólito','Ape':'Gorila','Awakened Shrub':'Arbusto Desperto',
'Brown Bear':'Urso Pardo','Death Dog':'Cão da Morte','Dryad':'Dríade','Specter':'Espectro','Ettercap':'Ettercap',
'Phase Spider':'Aranha Fásica','Green Hag':'Bruxa Verde','Shambling Mound':'Montão Rastejante','Earth Elemental':'Elemental da Terra',
'Xorn':'Xorn','Ogre':'Ogro','Winter Wolf':'Lobo Invernal','Polar Bear':'Urso Polar','Frost Giant':'Gigante do Gelo',
'Young Black Dragon':'Dragão Negro Jovem','Young Red Dragon':'Dragão Vermelho Jovem','Vrock':'Vrock','Hezrou':'Hezrou',
'Chain Devil':'Diabo das Correntes','Aboleth':'Abolete','Guardian Naga':'Naga Guardiã','Mummy Lord':'Senhor das Múmias',
'Ancient Red Dragon':'Dragão Vermelho Ancião','Ancient Blue Dragon':'Dragão Azul Ancião','Ancient Green Dragon':'Dragão Verde Ancião',
'Ancient White Dragon':'Dragão Branco Ancião','Ancient Gold Dragon':'Dragão Dourado Ancião','Kraken':'Kraken','Pit Fiend':'Diabo do Fosso',
'Balor':'Balor','Solar':'Solar','Iron Golem':'Golem de Ferro','Purple Worm':'Verme Púrpura','Hydra':'Hidra'
}

CONDITIONS=['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','exhaustion']
DAMAGE_TYPES=['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder']

def cr_value(value):
    try: return float(Fraction(str(value).strip()))
    except Exception:
        try: return float(value)
        except Exception: return 0.0

def level_for_cr(cr):
    cr=float(cr)
    if cr <= 0: return 1
    if cr <= 0.125: return 1
    if cr <= 0.25: return 2
    if cr <= 0.5: return 4
    if cr <= 1: return 8
    return int(round(8 + (cr-1)*6))

def average_dice(expr):
    total=0.0
    # Handles forms 2d6 + 5, 1d8-1
    for count, sides, sign, bonus in re.findall(r'(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?', expr or '', flags=re.I):
        total += int(count)*(int(sides)+1)/2
        if bonus:
            total += int(bonus) if sign!='-' else -int(bonus)
    return total

def action_damage(action):
    desc=action.get('desc') or ''
    values=[]
    for avg,dice,typ in re.findall(r'(?<!DC\s)(\d+)\s*\(([^)]+)\)\s*([A-Za-z]+)\s+damage', desc, flags=re.I):
        values.append({'average':float(avg),'dice':dice.strip(),'type':typ.lower()})
    if not values:
        for avg,typ in re.findall(r'(?:takes?|Hit:)\s*(\d+)\s+([A-Za-z]+)\s+damage', desc, flags=re.I):
            values.append({'average':float(avg),'dice':None,'type':typ.lower()})
    return values

def parse_action(action):
    name=action.get('name') or 'Ação'
    desc=action.get('desc') or ''
    damages=action_damage(action)
    recharge=None
    match=re.search(r'Recharge\s*(\d)(?:\s*[-–]\s*(\d))?', name+' '+desc, flags=re.I)
    if match:
        recharge={'min':int(match.group(1)),'max':int(match.group(2) or match.group(1))}
    attack_bonus=None
    match=re.search(r'Attack:?\s*\+(\d+)', desc, flags=re.I)
    if match: attack_bonus=int(match.group(1))
    save_dc=None
    match=re.search(r'DC\s*(\d+)', desc, flags=re.I)
    if match: save_dc=int(match.group(1))
    conditions=[c for c in CONDITIONS if re.search(r'\b'+re.escape(c)+r'\b',desc,re.I)]
    healing=None
    match=re.search(r'regains?\s+(\d+)(?:\s*\(([^)]+)\))?\s+Hit Points',desc,re.I)
    if match: healing={'average':int(match.group(1)),'dice':match.group(2)}
    lower=(name+' '+desc).lower()
    if 'multiattack' in name.lower(): kind='multiattack'
    elif healing: kind='healing'
    elif 'saving throw' in lower or save_dc: kind='save'
    elif 'ranged attack' in lower: kind='ranged'
    elif 'melee attack' in lower: kind='melee'
    else: kind='special'
    return {
        'id':re.sub(r'[^a-z0-9]+','_',name.lower()).strip('_'),
        'name':name,'type':kind,'description':desc,
        'damage':damages,'averageDamage':round(sum(d['average'] for d in damages),2),
        'attackBonus':attack_bonus,'saveDC':save_dc,'recharge':recharge,
        'conditions':conditions,'healing':healing
    }

def source_attack_average(mon):
    vals=[]
    for action in mon.get('actions') or []:
        if 'multiattack' in (action.get('name') or '').lower(): continue
        val=sum(d['average'] for d in action_damage(action))
        if val: vals.append(val)
    return max(vals) if vals else max(1, cr_value(mon.get('challenge_rating'))*3+2)

def normalize(mon):
    cr=cr_value(mon.get('challenge_rating'))
    lvl=level_for_cr(cr)
    tier=max(1,math.ceil(lvl/10))
    src_hp=max(1,float(mon.get('hit_points') or 1))
    expected_src_hp=max(6, 12 + cr*14)
    durability=max(.65,min(1.55,src_hp/expected_src_hp))
    hp=round((18 + lvl*5.2)*durability)
    src_dmg=source_attack_average(mon)
    expected_src_dmg=max(2,3+cr*3.2)
    offense=max(.72,min(1.45,src_dmg/expected_src_dmg))
    avg=max(2.0,(2.6+lvl*.48)*offense)
    dmg_min=max(1,round(avg*.72)); dmg_max=max(dmg_min+1,round(avg*1.28))
    ac=int(mon.get('armor_class') or 10)
    attrs=mon.get('attributes') or {}
    dex_mod=(float(attrs.get('dex') or 10)-10)/2
    str_mod=(float(attrs.get('str') or 10)-10)/2
    defense=max(0,round((ac-10)*.85 + lvl*.035))
    precision=max(3,round(8+dex_mod*1.6+lvl*.12))
    crit=max(.02,min(.18,round(.035+max(0,dex_mod)*.004,3)))
    evasion=max(.01,min(.20,round(.025+max(-1,dex_mod)*.006,3)))
    xp=max(2,round(3+lvl*1.55))
    rank='normal'
    if mon.get('legendary_actions'): rank='legendary'
    elif cr>=10: rank='boss'
    elif cr>=5: rank='elite'
    tags=[str(mon.get('type') or 'unknown').lower(),str(mon.get('size') or '').lower(),rank]
    if mon.get('speed',{}).get('fly'): tags.append('flying')
    if mon.get('speed',{}).get('swim'): tags.append('aquatic')
    if mon.get('speed',{}).get('burrow'): tags.append('burrowing')
    if str(mon.get('type')).lower() in ['beast','dragon','monstrosity','giant']: tags.append('skinnable')
    abilities=[parse_action(a) for a in (mon.get('actions') or [])]
    specials=[{'name':x.get('name'),'description':x.get('desc')} for x in (mon.get('special_abilities') or [])[:8]]
    return {
        'id':mon['id'],'sourceId':mon['id'],'slug':mon.get('slug'),'name':TRANSLATIONS.get(mon.get('name'),mon.get('name')),
        'sourceName':mon.get('name'),'catalogSource':'pocketdm-srd','source':mon.get('source'),
        'rulesetVersion':mon.get('ruleset_version'),'isSrd':True,'size':mon.get('size'),'type':str(mon.get('type') or 'unknown').lower(),
        'alignment':mon.get('alignment'),'challengeRating':mon.get('challenge_rating'),'challengeRatingValue':cr,
        'recommendedLevel':lvl,'level':lvl,'tier':tier,'rank':rank,'xp':xp,
        'hp':hp,'maxHp':hp,'damage':round((dmg_min+dmg_max)/2),'damageMin':dmg_min,'damageMax':dmg_max,
        'goldChance':min(.22,round(.07+tier*.008,3)),'goldMin':max(1,tier),'goldMax':max(1,tier*2),
        'stats':{
            'str':max(1,round(4+str_mod*1.2+lvl*.12)),'precision':precision,'defense':defense,
            'critical':crit,'evasion':evasion,'blockChance':0.0,'blockReduction':0.0,
            'damageMin':dmg_min,'damageMax':dmg_max,
            'mag':max(0,round((float(attrs.get('int') or 10)+float(attrs.get('wis') or 10)-20)/3))
        },
        'sourceStats':{'armorClass':ac,'hitPoints':mon.get('hit_points'),'hpFormula':mon.get('hp_formula'),'xp':mon.get('xp'),'attributes':attrs},
        'speed':mon.get('speed') or {},'abilities':abilities,'specialAbilities':specials,
        'resistances':mon.get('damage_resistances'),'vulnerabilities':mon.get('damage_vulnerabilities'),
        'immunities':mon.get('damage_immunities'),'conditionImmunities':mon.get('condition_immunities'),
        'senses':mon.get('senses'),'languages':mon.get('languages'),'tags':sorted(set(tags)),
        'lootProfile':str(mon.get('type') or 'unknown').lower(),'lootTable':[],
        'sprite':None,'assetMissing':True,'sourceTokenUrl':mon.get('token_url'),'sourceUrl':mon.get('url')
    }

normalized=[normalize(m) for m in srd]
normalized.sort(key=lambda m:(m['recommendedLevel'],m['name']))

# Save filtered SRD raw source and normalized JSON.
filtered={'metadata':{**raw.get('metadata',{}),'filtered_for_runtime':'is_srd === true','total_monsters':len(srd)},'monsters':srd}
(DATA_SRC/'pocketdm_monstros_srd.json').write_text(json.dumps(filtered,ensure_ascii=False,indent=2),encoding='utf-8')
(DATA_GEN/'monster_catalog_srd.json').write_text(json.dumps({'metadata':{'count':len(normalized),'generatedFrom':'pocketdm_monstros_srd.json','schemaVersion':1},'monsters':normalized},ensure_ascii=False,indent=2),encoding='utf-8')

payload=json.dumps(normalized,ensure_ascii=False,separators=(',',':'))
js='''// MonsterCatalogData.js - Catálogo SRD pré-normalizado para execução local\n(function (Aethra) {\n    "use strict";\n    Aethra.MonsterCatalogData = %s;\n})(window.Aethra = window.Aethra || {});\n'''%payload
(JS_DATA/'MonsterCatalogData.js').write_text(js,encoding='utf-8')

print(f'Catálogo gerado: {len(normalized)} criaturas SRD')
