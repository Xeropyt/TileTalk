import { RIICHI_DEFAULTS } from '../riichi';
import type { PatternDef, Ruleset } from '../types';

// Yaku that need sets, so they never go with seven pairs.
const NEEDS_SETS = [
  'pinfu',
  'iipeikou',
  'yakuhai_dragon',
  'yakuhai_seat',
  'yakuhai_round',
  'sanshoku_doujun',
  'ittsu',
  'chanta',
  'junchan',
  'toitoi',
  'sanankou',
  'sanshoku_doukou',
  'sankantsu',
  'shousangen',
  'ryanpeikou',
  'rinshan',
  'chankan',
];
// Yaku that need a triplet or kan, so they never go with pinfu (four sequences).
const NEEDS_TRIPLETS = ['yakuhai_dragon', 'yakuhai_seat', 'yakuhai_round', 'toitoi', 'sanankou', 'sanshoku_doukou', 'sankantsu', 'shousangen'];

const yaku = (
  id: string,
  name: string,
  chinese: string,
  closed: number,
  open: number | null,
  group: PatternDef['group'],
  description: string,
  extra: Partial<PatternDef> = {},
): PatternDef => ({ id, name, chinese, tai: closed, openTai: open, group, description, ...extra });

const yakuman = (id: string, name: string, chinese: string, description: string, closedOnly: boolean): PatternDef => ({
  id,
  name,
  chinese,
  tai: 0,
  openTai: closedOnly ? null : 0,
  limit: true,
  group: 'limit',
  description,
});

/**
 * Standard modern Riichi, as played by most clubs and online apps. Scored with han and fu, not
 * tai, so the hand screen takes han and fu directly; these patterns are the Rules page reference.
 */
export const riichiRules: Ruleset = {
  id: 'riichi',
  name: 'Riichi',
  description: 'Japanese mahjong scored with han and fu, riichi sticks, dora, oka and uma. No flowers.',
  scoringModel: 'hanFu',
  handSize: 13,
  riichiDefaults: RIICHI_DEFAULTS,
  groupNames: {
    bonus: 'Dora (only with a yaku)',
    sets: 'Value sets',
    shape: 'Hand shape',
    winning: 'Riichi and how you won',
    limit: 'Yakuman (limit hands)',
  },
  // Not used: Riichi pays from han and fu (see riichi.ts). Kept so shared code has numbers.
  payment: { basePoints: 1, minTai: 1, maxTai: 13, discard: 'shooterOnly', selfDrawMultiplier: 1 },
  immediatePayouts: [],
  rotation: { dealerStaysOnWin: true, dealerStaysOnDraw: false },
  patterns: [
    // How you won
    yaku('riichi', 'Riichi', '立直', 1, null, 'winning', 'Declared riichi: closed and tenpai, with a 1,000-point stick on the table.', {
      excludes: ['double_riichi'],
    }),
    yaku('double_riichi', 'Double riichi', 'ダブル立直', 2, null, 'winning', 'Riichi on your very first discard, with no calls before it.'),
    yaku('ippatsu', 'Ippatsu', '一発', 1, null, 'winning', 'Win within one go-around of declaring riichi, with no calls in between.'),
    yaku('menzen_tsumo', 'Menzen tsumo', '門前清自摸和', 1, null, 'winning', 'Tsumo with a closed hand.', {
      requires: { winType: 'selfDraw' },
    }),
    yaku('haitei', 'Haitei raoyue', '海底摸月', 1, 1, 'winning', 'Tsumo on the last tile of the live wall.', {
      requires: { winType: 'selfDraw' },
      excludes: ['houtei', 'rinshan'],
    }),
    yaku('houtei', 'Houtei raoyui', '河底撈魚', 1, 1, 'winning', 'Ron on the last discard of the hand.', {
      requires: { winType: 'discard' },
    }),
    yaku('rinshan', 'Rinshan kaihou', '嶺上開花', 1, 1, 'winning', 'Tsumo on the replacement tile after a kan.', {
      requires: { winType: 'selfDraw' },
    }),
    yaku('chankan', 'Chankan', '搶槓', 1, 1, 'winning', 'Ron on a tile someone adds to their pon to make a kan.', {
      requires: { winType: 'discard' },
    }),

    // Value sets
    yaku('yakuhai_dragon', 'Yakuhai: dragon', '役牌', 1, 1, 'sets', 'A triplet or kan of white, green or red dragon. 1 han each.', {
      maxCount: 3,
    }),
    yaku('yakuhai_seat', 'Yakuhai: seat wind', '自風', 1, 1, 'sets', 'A triplet or kan of your seat wind.'),
    yaku('yakuhai_round', 'Yakuhai: round wind', '場風', 1, 1, 'sets', 'A triplet or kan of the round wind. Counts again if it’s also your seat wind.'),

    // Hand shape
    yaku('pinfu', 'Pinfu', '平和', 1, null, 'shape', 'Four sequences, a pair that isn’t a value tile, and a two-sided wait.', {
      excludes: NEEDS_TRIPLETS,
    }),
    yaku('tanyao', 'Tanyao', '断幺九', 1, 1, 'shape', 'Only simples (2–8): no terminals or honours. Open is allowed (kuitan).', {
      excludes: ['chanta', 'junchan', 'honroutou', 'yakuhai_dragon', 'yakuhai_seat', 'yakuhai_round'],
    }),
    yaku('iipeikou', 'Iipeikou', '一盃口', 1, null, 'shape', 'Two identical sequences in the same suit.', { excludes: ['ryanpeikou'] }),
    yaku('chiitoitsu', 'Chiitoitsu', '七対子', 2, null, 'shape', 'Seven different pairs. Always 25 fu.', { excludes: NEEDS_SETS }),
    yaku('sanshoku_doujun', 'Sanshoku doujun', '三色同順', 2, 1, 'shape', 'The same sequence in all three suits, e.g. 345m 345p 345s.'),
    yaku('ittsu', 'Ittsu', '一気通貫', 2, 1, 'shape', '123, 456 and 789 in one suit.'),
    yaku('chanta', 'Chanta', '混全帯幺九', 2, 1, 'shape', 'Every set and the pair have a terminal or honour, with at least one sequence.', {
      excludes: ['junchan', 'honroutou'],
    }),
    yaku('toitoi', 'Toitoi', '対々和', 2, 2, 'shape', 'Four triplets or kans.'),
    yaku('sanankou', 'Sanankou', '三暗刻', 2, 2, 'shape', 'Three concealed triplets. A triplet finished by ron counts as open.'),
    yaku('sanshoku_doukou', 'Sanshoku doukou', '三色同刻', 2, 2, 'shape', 'Triplets of the same number in all three suits.'),
    yaku('sankantsu', 'Sankantsu', '三槓子', 2, 2, 'shape', 'Three kans of any kind.'),
    yaku('shousangen', 'Shousangen', '小三元', 2, 2, 'shape', 'Two dragon triplets and a dragon pair. The two dragon yakuhai add 2 more han.'),
    yaku('honroutou', 'Honroutou', '混老頭', 2, 2, 'shape', 'Only terminals and honours. Always with toitoi or chiitoitsu.', {
      excludes: ['junchan'],
    }),
    yaku('ryanpeikou', 'Ryanpeikou', '二盃口', 3, null, 'shape', 'Two different iipeikou. Scored instead of chiitoitsu.'),
    yaku('junchan', 'Junchan', '純全帯幺九', 3, 2, 'shape', 'Every set and the pair have a terminal, no honours, at least one sequence.'),
    yaku('honitsu', 'Honitsu', '混一色', 3, 2, 'shape', 'One suit plus honours.', { excludes: ['chinitsu'] }),
    yaku('chinitsu', 'Chinitsu', '清一色', 6, 5, 'shape', 'One suit only, no honours.'),

    // Dora: add han, but never count as the yaku a hand needs
    yaku('dora', 'Dora', 'ドラ', 1, 1, 'bonus', 'Each tile matching the dora: the tile after the indicator (9 wraps to 1, North to East, Red to White).', {
      maxCount: 20,
    }),
    yaku('aka_dora', 'Red fives', '赤ドラ', 1, 1, 'bonus', 'Each red 5. By default one each of 5m, 5p and 5s.', { maxCount: 4 }),
    yaku('ura_dora', 'Ura dora', '裏ドラ', 1, null, 'bonus', 'The tiles under the dora indicators. Only for a winner who declared riichi.', {
      maxCount: 20,
    }),
    yaku('kita', 'Kita (three players)', '抜きドラ', 1, 1, 'bonus', 'Each North set aside in a three-player game counts as a dora.', {
      maxCount: 4,
    }),

    // Yakuman
    yakuman('kokushi', 'Kokushi musou', '国士無双', 'One of each terminal and honour, plus one duplicate.', true),
    yakuman('suuankou', 'Suuankou', '四暗刻', 'Four concealed triplets. Ron on a two-pair wait makes it sanankou.', true),
    yakuman('daisangen', 'Daisangen', '大三元', 'Triplets or kans of all three dragons.', false),
    yakuman('shousuushii', 'Shousuushii', '小四喜', 'Three wind triplets plus a wind pair.', false),
    yakuman('daisuushii', 'Daisuushii', '大四喜', 'Triplets or kans of all four winds.', false),
    yakuman('tsuuiisou', 'Tsuuiisou', '字一色', 'Only honour tiles. Seven pairs of honours counts too.', false),
    yakuman('chinroutou', 'Chinroutou', '清老頭', 'Only terminals: 1s and 9s.', false),
    yakuman('ryuuiisou', 'Ryuuiisou', '緑一色', 'Only 2, 3, 4, 6 and 8 sou and green dragon.', false),
    yakuman('chuuren', 'Chuuren poutou', '九蓮宝燈', '1112345678999 in one suit, plus any tile of that suit.', true),
    yakuman('suukantsu', 'Suukantsu', '四槓子', 'Four kans.', false),
    yakuman('tenhou', 'Tenhou', '天和', 'The dealer wins on their first 14 tiles.', true),
    yakuman('chiihou', 'Chiihou', '地和', 'A non-dealer wins by tsumo on their first draw, with no calls before it.', true),
  ],
  notes: [
    {
      title: 'Winning',
      body: 'A hand needs four sets and a pair (or seven pairs, or thirteen orphans) and at least one yaku. Dora never count as the yaku. Ron: the discarder pays everything. Tsumo: everyone else pays. A player in furiten (one of their winning tiles is in their own discards, or they passed on a win) can’t ron, but can tsumo.',
    },
    {
      title: 'Fu',
      body: 'Only matter up to 4 han. Start at 20, add 10 for a closed ron or 2 for a tsumo, 2 for a kanchan, penchan or pair wait, 2 for a value pair, and 2–32 for each triplet or kan, then round up to 10. Fixed: chiitoitsu 25, pinfu tsumo 20, pinfu ron 30. Most hands are 30 or 40.',
    },
    {
      title: 'Points',
      body: 'Base = fu × 2^(2 + han), at most 2,000. Ron: the discarder pays base × 4 (dealer winner × 6). Tsumo: the dealer pays base × 2 and others base × 1 (dealer winner: everyone pays × 2). Round each payment up to 100. Mangan 5 han (8,000 / 12,000 dealer), haneman 6–7, baiman 8–10, sanbaiman 11–12, yakuman 13+ (32,000 / 48,000).',
    },
    {
      title: 'Honba and riichi sticks',
      body: 'Each honba adds 300 to a win: paid by the discarder on a ron, 100 each on a tsumo. The winner also takes every riichi stick on the table. Honba go up when the dealer keeps the deal or a hand is drawn, and reset when a non-dealer wins.',
    },
    {
      title: 'Draws',
      body: 'Exhaustive draw: noten players pay tenpai players 3,000 between them (2,000 with three players), and the dealer keeps the deal only if tenpai. Nagashi mangan (all discards terminals and honours, none called) is paid as a mangan tsumo instead. Abortive draws (nine terminals, four winds, four riichi, four kans) replay the hand with the same dealer.',
    },
    {
      title: 'Chombo',
      body: 'A false win or other serious mistake: the offender pays a reverse mangan (2,000 to each non-dealer and 4,000 to the dealer, or 4,000 each if they’re the dealer), and the hand is replayed. It counts towards the Za-hu title.',
    },
    {
      title: 'Game end, oka and uma',
      body: 'A hanchan is the East and South rounds; a tonpuusen is East only. The game ends after the last hand, or when someone drops below 0. Each score has the return points (30,000) taken off; first place gets the oka (the 20,000 difference) and any leftover sticks; then uma by place (default +15 / +5 / −5 / −15). Results are in thousands and add up to zero.',
    },
    {
      title: 'Three players (sanma)',
      body: 'No North seat, no chii, and 2–8 man are removed. North tiles are set aside as dora (kita). Default 35,000 start and 40,000 return, uma +20 / 0 / −20, and 2,000 tenpai payments. On a tsumo the missing North share isn’t paid (tsumo loss), unless the game turns that off.',
    },
  ],
};
