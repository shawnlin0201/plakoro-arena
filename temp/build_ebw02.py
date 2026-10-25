#!/usr/bin/env python3
"""Fold the EBW02 set into the generated data and the translation overlays.

Two sources, deliberately split:

  * id / move names / card type / energy cost / base damage  -> the review markdown
  * every effect, its value and the chara-die faces          -> read off the card scans

The markdown's effect column turned out to be unreliable (035-037 were shifted by one, a
few damage values were wrong, four upper-half effects were missing entirely), so nothing
about an effect is taken from it. The faces come from the登録 tool's export, which is what
a human read off the physical cards.

Run from the repo root. Idempotent: re-running replaces the EBW02/EBC02 rows rather than
appending a second copy.
"""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[1]
MD = ROOT / 'temp/EBW02_60_cards_review_with_damage.md'

# --- vocabularies -----------------------------------------------------------------

ENERGY = {'草': 'くさ', '火': 'ほのお', '水': 'みず', '電': 'かみなり', '鋼': 'はがね',
          '惡': 'あく', '鬥': 'かくとう', '超': 'ちょう', '飛': 'ひこう', '龍': 'ドラゴン',
          '任': '無色', '無色': '無色'}
COUNT = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5}

# The six EBW02 characters, in card-number order. HP and the +20 weakness match every
# other character in the game, but they are written out rather than assumed.
CHARA = [
    ('EBC02-001', 'ゲッコウガ', 'みず',     'くさ',     '甲賀忍蛙',   'Greninja'),
    ('EBC02-002', 'カヌチャン', 'ちょう',   'ほのお',   '小鍛匠',     'Tinkatink'),
    ('EBC02-003', 'ヤミラミ',   'あく',     'ちょう',   '勾魂眼',     'Sableye'),
    ('EBC02-004', 'ボスゴドラ', 'はがね',   'かくとう', '波士可多拉', 'Aggron'),
    ('EBC02-005', 'レックウザ', 'ドラゴン', 'ドラゴン', '烈空坐',     'Rayquaza'),
    ('EBC02-006', 'ラッキー',   '無色',     'かくとう', '吉利蛋',     'Chansey'),
]

CHARA_BY_ZH = {zh: ja for _, ja, _, _, zh, _ in CHARA}

# --- effects, transcribed from the card scans -------------------------------------
#
# waza:   (jp text, effect type, value) for the upper band, or None
# slots:  one tuple per chara-die row, in the order the rows appear on the card
#
# Effect types already handled by effectQueue are used as-is. The six new mechanics get
# names of their own so `effectCoverage` lists them at startup instead of them vanishing
# into the default branch: NULLIFY_TAKEN_LE, HEAL_SELF, HEAL_SELF_FULL, REROLL_DICE_ENEMY,
# REROLL_CHARADICE_SELF, SPECIAL_SWAP_CHIP, SPECIAL_PICK_ENEMY_WAZA,
# DAMAGE_EXTRA_IF_UNHURT.
D = 'DAMAGE_EXTRA'
EFFECTS = {
 'EBW02-001': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-002': (None, [('自分のエネコロを1個選び、カスタムチップを好きなだけつけ替える。（自分の持っているカスタムチップを使う。）', 'SPECIAL_SWAP_CHIP', 1)]),
 'EBW02-003': (('このワザはキャラコロを合計3回振る。', None, 0),
               [('このワザでキャラコロが成功するたび、20ダメージ追加。', 'DAMAGE_EXTRA_3CHARADICE', 20)]),
 'EBW02-004': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-005': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-006': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-007': (None, [('40ダメージ追加。', D, 40)]),
 'EBW02-008': (('このワザはキャラコロを合計2回振る。', None, 0),
               [('このワザでキャラコロが成功するたび、40ダメージ追加。', 'DAMAGE_EXTRA_2CHARADICE', 40)]),
 'EBW02-009': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-010': (None, [('20ダメージ追加。', D, 20)]),

 'EBW02-011': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-012': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-013': (None, [('60ダメージ追加。', D, 60),
                      ('次の自分の番、自分の振るエネコロを2個少なくする。', 'MOD_DICE_SELF', -2)]),
 'EBW02-014': (('次の相手の番、相手の振るエネコロを1個少なくする。', 'MOD_DICE_ENEMY', -1),
               [('40ダメージ追加。', D, 40)]),
 'EBW02-015': (None, [('40ダメージ追加。', D, 40)]),
 'EBW02-016': (None, [('10ダメージ追加。', D, 10)]),
 'EBW02-017': (('このポケモンのHPを10回復する。', 'HEAL_SELF', 10),
               [('30ダメージ追加。', D, 30)]),
 'EBW02-018': (None, [('40ダメージ追加。', D, 40)]),
 'EBW02-019': (None, [('50ダメージ追加。', D, 50),
                      ('このポケモンにも30ダメージ。', 'DAMAGE_SELF', 30)]),
 'EBW02-020': (None, [('60ダメージ追加。', D, 60)]),

 'EBW02-021': (None, [('10ダメージ追加。', D, 10)]),
 'EBW02-022': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-023': (None, [('次の相手のワザで振ったエネコロを1個選び、振りなおさせる。（振りなおすエネコロは自分が選ぶ。）', 'REROLL_DICE_ENEMY', 1)]),
 'EBW02-024': (None, [('次の相手の番、相手が使うワザは自分が選ぶ。', 'SPECIAL_PICK_ENEMY_WAZA', 1)]),
 'EBW02-025': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-026': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-027': (None, [('次の相手の番、相手のキャラコロの向きを[下]にする。', 'FIX_CHARADICE_ENEMY_下', 1)]),
 'EBW02-028': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-029': (None, [('次の相手のワザで振ったエネコロを2個選び、振りなおさせる。（振りなおすエネコロは自分が選ぶ。）', 'REROLL_DICE_ENEMY', 2)]),
 'EBW02-030': (None, [('20ダメージ追加。', D, 20)]),

 'EBW02-031': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-032': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-033': (None, [('次の相手の番、このポケモンが受けるダメージが40以下なら、そのダメージを受けない。', 'NULLIFY_TAKEN_LE', 40)]),
 'EBW02-034': (None, [('40ダメージ追加。', D, 40),
                      ('このポケモンにも40ダメージ。', 'DAMAGE_SELF', 40)]),
 'EBW02-035': (None, [('次の相手の番、相手の振るエネコロを1個少なくする。', 'MOD_DICE_ENEMY', -1)]),
 'EBW02-036': (None, [('10ダメージ追加。', D, 10)]),
 'EBW02-037': (None, [('次の相手の番、このポケモンが受けるダメージが30以下なら、そのダメージを受けない。', 'NULLIFY_TAKEN_LE', 30)]),
 'EBW02-038': (None, [('前の相手の番、このポケモンがワザのダメージを受けていないなら、40ダメージ追加。', 'DAMAGE_EXTRA_IF_UNHURT', 40)]),
 'EBW02-039': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-040': (None, [('20ダメージ追加。', D, 20)]),

 'EBW02-041': (None, [('10ダメージ追加。', D, 10)]),
 'EBW02-042': (None, [('30ダメージ追加。', D, 30),
                      ('次の自分の番、自分の振るエネコロを2個少なくする。', 'MOD_DICE_SELF', -2)]),
 'EBW02-043': (None, [('次の相手の番、相手の振るエネコロを1個少なくする。', 'MOD_DICE_ENEMY', -1)]),
 'EBW02-044': (None, [('60ダメージ追加。', D, 60)]),
 'EBW02-045': (None, [('30ダメージ追加。', D, 30),
                      ('このポケモンにも30ダメージ。', 'DAMAGE_SELF', 30)]),
 'EBW02-046': (None, [('10ダメージ追加。', D, 10)]),
 'EBW02-047': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-048': (None, [('20ダメージ追加。', D, 20)]),
 'EBW02-049': (None, [('エネコロで出たほのおエネルギーの数×20ダメージ追加。', 'DAMAGE_EXTRA_ENE', 20)]),
 'EBW02-050': (None, [('60ダメージ追加。', D, 60)]),

 'EBW02-051': (None, [('40ダメージ追加。', D, 40)]),
 'EBW02-052': (('次の自分の番、キャラコロを1回振りなおせる。', 'REROLL_CHARADICE_SELF', 1),
               [('1回ではなく2回振りなおせる。', 'REROLL_CHARADICE_SELF', 2)]),
 'EBW02-053': (None, [('50ダメージ追加。', D, 50)]),
 'EBW02-054': (None, [('このポケモンのHPを50回復する。', 'HEAL_SELF', 50)]),
 'EBW02-055': (None, [('30ダメージ追加。', D, 30)]),
 'EBW02-056': (None, [('40ダメージ追加。', D, 40)]),
 'EBW02-057': (('このポケモンのHPを20回復する。', 'HEAL_SELF', 20),
               [('このポケモンのHPをすべて回復する。', 'HEAL_SELF_FULL', 0)]),
 'EBW02-058': (None, [('次の自分の番、キャラコロを1回振りなおせる。', 'REROLL_CHARADICE_SELF', 1)]),
 'EBW02-059': (None, [('60ダメージ追加。', D, 60)]),
 'EBW02-060': (None, [('30ダメージ追加。', D, 30),
                      ('次の自分の番、自分の振るエネコロを1個少なくする。', 'MOD_DICE_SELF', -1)]),
}

# Chinese for each effect, in the same order. English is derived where the phrasing is
# formulaic and written out where it is not.
ZH = {
 D: lambda v: f'追加{v}點傷害。',
 'DAMAGE_SELF': lambda v: f'這隻寶可夢也受到{v}點傷害。',
 'MOD_DICE_SELF': lambda v: f'下一個自己的回合，自己擲的能量骰少{abs(v)}顆。',
 'MOD_DICE_ENEMY': lambda v: f'下一個對手的回合，對手擲的能量骰少{abs(v)}顆。',
 'DAMAGE_EXTRA_2CHARADICE': lambda v: f'這個招式每次角色骰成功，追加{v}點傷害。',
 'DAMAGE_EXTRA_3CHARADICE': lambda v: f'這個招式每次角色骰成功，追加{v}點傷害。',
 'DAMAGE_EXTRA_ENE': lambda v: f'能量骰擲出的火能量數量×{v}點傷害。',
 'NULLIFY_TAKEN_LE': lambda v: f'下一個對手的回合，這隻寶可夢受到的傷害若為 {v} 以下，則不受到該傷害。',
 'HEAL_SELF': lambda v: f'這隻寶可夢回復 {v} 點 HP。',
 'HEAL_SELF_FULL': lambda v: '這隻寶可夢回復全部 HP。',
 'REROLL_DICE_ENEMY': lambda v: f'下一個對手的招式，選 {v} 顆他擲出的能量骰重擲（由自己選哪幾顆）。',
 'REROLL_CHARADICE_SELF': lambda v: ('下一個自己的回合，角色骰可以重擲 1 次。' if v == 1
                                     else '改成可以重擲 2 次，而不是 1 次。'),
 'SPECIAL_SWAP_CHIP': lambda v: '選自己的 1 顆能量骰，任意更換上面的客製晶片（使用自己持有的晶片）。',
 'SPECIAL_PICK_ENEMY_WAZA': lambda v: '下一個對手的回合，對手要用哪個招式由自己指定。',
 'DAMAGE_EXTRA_IF_UNHURT': lambda v: f'上一個對手的回合，這隻寶可夢沒有受到招式傷害的話，追加{v}點傷害。',
 'FIX_CHARADICE_ENEMY_下': lambda v: '下一個對手的回合，把對手的角色骰朝向固定為「下」。',
 None: lambda v: '',
}
EN = {
 D: lambda v: f'Adds {v} damage.',
 'DAMAGE_SELF': lambda v: f'This Pokemon also takes {v} damage.',
 'MOD_DICE_SELF': lambda v: f'On your next turn, roll {abs(v)} fewer energy dice.',
 'MOD_DICE_ENEMY': lambda v: f"On your opponent's next turn, they roll {abs(v)} fewer energy dice.",
 'DAMAGE_EXTRA_2CHARADICE': lambda v: f'Adds {v} damage for each character die success on this move.',
 'DAMAGE_EXTRA_3CHARADICE': lambda v: f'Adds {v} damage for each character die success on this move.',
 'DAMAGE_EXTRA_ENE': lambda v: f'Adds damage equal to the number of Fire energy rolled x{v}.',
 'NULLIFY_TAKEN_LE': lambda v: f"On your opponent's next turn, if this Pokemon would take {v} damage or less, it takes none.",
 'HEAL_SELF': lambda v: f'Heal {v} HP on this Pokemon.',
 'HEAL_SELF_FULL': lambda v: 'Heal this Pokemon fully.',
 'REROLL_DICE_ENEMY': lambda v: f"On your opponent's next move, choose {v} of the energy dice they rolled and make them reroll.",
 'REROLL_CHARADICE_SELF': lambda v: ('On your next turn, you may reroll the character die once.' if v == 1
                                     else 'Reroll it twice instead of once.'),
 'SPECIAL_SWAP_CHIP': lambda v: 'Choose one of your energy dice and swap its custom chips freely (using chips you own).',
 'SPECIAL_PICK_ENEMY_WAZA': lambda v: "On your opponent's next turn, you choose which move they use.",
 'DAMAGE_EXTRA_IF_UNHURT': lambda v: f'If this Pokemon took no move damage on the previous opponent turn, adds {v} damage.',
 'FIX_CHARADICE_ENEMY_下': lambda v: "On your opponent's next turn, fix their character die to [bottom].",
 None: lambda v: '',
}

WAZA_EN = {
 'たきのぼり': 'Waterfall', 'へんげきり': 'Transform Slash', 'みずしゅりけん': 'Water Shuriken',
 'かげうち': 'Shadow Sneak', 'つじぎり': 'Night Slash', 'みずでっぽう': 'Water Gun',
 'かすみぎり': 'Mist Slash', 'ぶんしんのじゅつ': 'Double Team', 'くさわけ': 'Trailblaze',
 'けたぐり': 'Low Kick', 'たたく': 'Pound', 'ようせいのかぜ': 'Fairy Wind',
 'ハンマーストライク': 'Hammer Strike', 'じゃれつく': 'Play Rough', 'メタルクロー': 'Metal Claw',
 'どつく': 'Slam', 'ドレインキッス': 'Draining Kiss', 'なきわめく': 'Howl',
 'ワイルドスタンプ': 'Wild Stomp', 'ワンダーインパクト': 'Wonder Impact',
 'ツメでひっかく': 'Scratch', 'だましうち': 'Feint Attack', 'ほりかえす': 'Dig Up',
 'そそのかす': 'Tempt', 'こごえるかぜ': 'Icy Wind', 'ダーククロー': 'Dark Claw',
 'ころばす': 'Trip', 'あくのはどう': 'Dark Pulse', 'ジュエルフラッシュ': 'Jewel Flash',
 'サイケこうせん': 'Psybeam', 'はがねのずつき': 'Iron Head Butt',
 'タイラントシールド': 'Tyrant Shield', 'とつげき': 'Charge', 'がんせきふうじ': 'Rock Tomb',
 'ぶつかる': 'Tackle', 'こうてつボディ': 'Steel Body', 'パワフルスチール': 'Powerful Steel',
 'アイアンヘッド': 'Iron Head', 'れいとうパンチ': 'Ice Punch', 'ひきさく': 'Tear',
 'りゅうのはどう': 'Dragon Pulse', 'ワイドブレイカー': 'Breaking Swipe',
 'げきりんランページ': 'Outrage Rampage', 'ドラゴンフレイム': 'Dragon Flame',
 'たつまき': 'Twister', 'ドラゴンクロー': 'Dragon Claw', 'ドラゴンテール': 'Dragon Tail',
 'ドラゴンバースト': 'Dragon Burst', 'かみなり': 'Thunder', 'はたく': 'Pound',
 'チャンスタックル': 'Chance Tackle', 'まるまるアタック': 'Round Attack',
 'ドレインビンタ': 'Draining Slap', 'シャドーボール': 'Shadow Ball', 'ひらてうち': 'Palm Strike',
 'タマゴうみ': 'Softboiled', 'ラッキーパンチ': 'Lucky Punch', 'ぶちかまし': 'Heavy Slam',
 'かえんほうしゃ': 'Flamethrower',
}

# --- parse the markdown for the fields it is trusted with -------------------------

def parse_md():
    out = {}
    for b in re.split(r'\n---\n', MD.read_text(encoding='utf-8')):
        m = re.search(r'^## (EBW02-\d+)｜', b, re.M)
        if not m:
            continue
        f = lambda k: (re.search(rf'^{k}：(.*)$', b, re.M) or [None, ''])[1].strip()
        out[m.group(1)] = {
            'chara_zh': f('角色'), 'name_zh': f('招式中文名稱'), 'name_ja': f('招式日文名稱'),
            'type_zh': f('招式卡片本身能量'), 'cost_zh': f('招式卡片需求能量'),
            'damage': f('上半部傷害'),
        }
    return out

def parse_cost(s):
    if s == '待確認':
        return None
    out = []
    for n, e in re.findall(r'([一二三四五])(.)', s):
        out += [ENERGY[e]] * COUNT[n]
    if not out:
        raise SystemExit(f'cannot parse cost: {s!r}')
    return ','.join(out)

def parse_damage(s):
    m = re.match(r'^(\d+)', s)
    return int(m.group(1)) if m else 0

# --- build ------------------------------------------------------------------------

md = parse_md()
faces = {r['id']: r for r in json.loads((ROOT / 'temp/cardtool/charadie-filled.json').read_text(encoding='utf-8'))}

waza_rows, zh_waza, en_waza = [], {}, {}
problems = []

for cid in sorted(md):
    info, (upper, slots) = md[cid], EFFECTS[cid]
    cost = parse_cost(info['cost_zh'])
    if cost is None:
        problems.append(f'{cid} {info["name_ja"]}：需求能量未知（卡面被 TOP 按鈕蓋住）')
        cost = ''
    row = {
        'id': cid,
        'chara_name': CHARA_BY_ZH[info['chara_zh']],
        'waza_name': info['name_ja'],
        'waza_type': ENERGY[info['type_zh']],
        'waza_damage': parse_damage(info['damage']),
        'waza_effect': upper[0] if upper else None,
        'waza_effect_type': upper[1] if upper else None,
        'waza_effect_value': upper[2] if upper else 0,
        'waza_energy': cost,
    }
    tr_zh = {'name': info['name_zh']}
    tr_en = {'name': WAZA_EN[info['name_ja']]}
    if upper:
        tr_zh['effect'] = ZH[upper[1]](upper[2])
        tr_en['effect'] = EN[upper[1]](upper[2])

    for i in (1, 2, 3):
        slot = slots[i - 1] if i <= len(slots) else None
        die = faces.get(cid, {}).get(f'chara_die{i}')
        if slot and not die:
            problems.append(f'{cid} {info["name_ja"]}：第 {i} 排角色骰面未填')
        if not slot and die:
            problems.append(f'{cid} {info["name_ja"]}：填了第 {i} 排的面，但卡面只有 {len(slots)} 排')
        row[f'chara_die{i}'] = die if slot else None
        row[f'chara_effect{i}'] = slot[0] if slot else None
        row[f'chara_effect_type{i}'] = slot[1] if slot else None
        row[f'chara_effect_value{i}'] = slot[2] if slot else 0
        if slot:
            tr_zh[f'chara_effect{i}'] = ZH[slot[1]](slot[2])
            tr_en[f'chara_effect{i}'] = EN[slot[1]](slot[2])

    # Column order has to match the rows already in the file, or a diff of the generated
    # JSON becomes unreadable noise.
    waza_rows.append({k: row[k] for k in (
        'id', 'chara_name', 'waza_name', 'waza_type', 'waza_damage', 'waza_effect',
        'waza_effect_type', 'waza_effect_value', 'chara_die1', 'chara_effect1',
        'chara_effect_type1', 'chara_effect_value1', 'chara_die2', 'chara_effect2',
        'chara_effect_type2', 'chara_effect_value2', 'waza_energy', 'chara_die3',
        'chara_effect3', 'chara_effect_type3', 'chara_effect_value3')})
    zh_waza[cid], en_waza[cid] = tr_zh, tr_en

chara_rows, zh_chara, en_chara = [], {}, {}
for cid, ja, ty, weak, zh, en in CHARA:
    chara_rows.append({'id': cid, 'name': ja, 'type': ty, 'HP': 120,
                       'weakness_type1': weak, 'weakness_damage1': 20,
                       'weakness_type2': None, 'weakness_damage2': None, 'image_URL': None})
    zh_chara[cid], en_chara[cid] = {'name': zh}, {'name': en}

# --- write ------------------------------------------------------------------------

def merge_local(section, rows, prefix):
    p = ROOT / 'src/data/localCards.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    d[section] = [r for r in d[section] if not r['id'].startswith(prefix)] + rows
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return len(d[section])

def merge_tr(loc, chara, waza):
    p = ROOT / f'src/data/translations/{loc}.json'
    d = json.loads(p.read_text(encoding='utf-8'), object_pairs_hook=collections.OrderedDict)
    d['chara'].update(chara)
    d['waza'].update(waza)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if '--check' not in sys.argv:
    # localCards.json, never generated/: that half is overwritten by `npm run fetch-data`.
    # NOTE this script is a one-off importer. Once the rows are in, edit localCards.json by
    # hand — re-running this would discard any correction made there.
    n1 = merge_local('chara', chara_rows, prefix='EBC02-')
    n2 = merge_local('waza', waza_rows, prefix='EBW02-')
    merge_tr('zh-TW', zh_chara, zh_waza)
    merge_tr('en', en_chara, en_waza)
    print(f'chara.json -> {n1} rows, waza.json -> {n2} rows, translations updated')

types = collections.Counter(
    t for r in waza_rows for t in
    [r['waza_effect_type']] + [r[f'chara_effect_type{i}'] for i in (1, 2, 3)] if t)
print('\neffect types used:')
for t, n in types.most_common():
    print(f'  {t}: {n}')
if problems:
    print('\n要處理的：')
    for p in problems:
        print('  -', p)
