import type { Ruleset } from '../types';

/** Patterns that need a pung of honour tiles. */
const HONOUR_SETS = [
  'dragon_pung',
  'seat_wind_pung',
  'prevailing_wind_pung',
  'small_three_dragons',
  'big_three_dragons',
  'small_four_winds',
  'big_four_winds',
  'all_honours',
];

/**
 * GG's house rules: a Singapore / Hong Kong mix, with flowers and no animals.
 *
 * Every number here is a starting point. Edit the tai values, the cap and the
 * payment settings so they match your group's scoring sheet exactly.
 */
export const houseRules: Ruleset = {
  id: 'house',
  name: 'House rules',
  description: 'Singapore and Hong Kong mix, flowers, no animals. Payment doubles per tai.',
  handSize: 13,
  payment: {
    basePoints: 1, // 1 tai = 1, 2 tai = 2, 3 tai = 4, 4 tai = 8...
    minTai: 1,
    maxTai: 5,
    discard: 'shooterDouble',
    selfDrawMultiplier: 2,
    falseWinTai: 5, // pay everyone as if they'd each won a limit hand
  },
  rotation: {
    dealerStaysOnWin: true,
    dealerStaysOnDraw: true,
  },
  patterns: [
    // Flowers
    {
      id: 'seat_flower',
      name: 'Own flower or season',
      chinese: '正花',
      tai: 1,
      maxCount: 2,
      group: 'bonus',
      description: 'The flower and season matching your seat. Count each one.',
    },
    {
      id: 'flower_set',
      name: 'Complete set of flowers or seasons',
      chinese: '一台花',
      tai: 1,
      maxCount: 2,
      group: 'bonus',
      description: 'All four flowers, or all four seasons.',
    },

    // Sets
    {
      id: 'dragon_pung',
      name: 'Dragon pung or kong',
      chinese: '三元牌',
      tai: 1,
      maxCount: 2,
      group: 'sets',
      description: 'Three of the red, green or white dragon. Three dragon pungs is Big three dragons.',
      excludes: ['big_four_winds'],
    },
    {
      id: 'seat_wind_pung',
      name: 'Seat wind pung or kong',
      chinese: '門風',
      tai: 1,
      group: 'sets',
      description: 'Three of your own seat’s wind. The dealer is always East.',
    },
    {
      id: 'prevailing_wind_pung',
      name: 'Round wind pung or kong',
      chinese: '圈風',
      tai: 1,
      group: 'sets',
      description: 'Three of the current round’s wind. Counts on top of your seat wind if they match.',
    },

    // Hand shape
    {
      id: 'all_chows',
      name: 'All chows',
      chinese: '平胡',
      tai: 1,
      group: 'shape',
      description: 'Four chows and a pair.',
      // Any pung or kong breaks it, and honour tiles can't make chows.
      excludes: [...HONOUR_SETS, 'all_pungs', 'thirteen_orphans', 'nine_gates', 'kong_replacement'],
    },
    {
      id: 'all_pungs',
      name: 'All pungs',
      chinese: '對對胡',
      tai: 2,
      group: 'shape',
      description: 'Four pungs or kongs and a pair.',
      // A robbed kong tile can't complete a pung or a pair: all four are already out.
      excludes: ['all_chows', 'thirteen_orphans', 'nine_gates', 'robbing_kong'],
    },
    {
      id: 'half_flush',
      name: 'Half flush',
      chinese: '混一色',
      tai: 2,
      group: 'shape',
      description: 'One suit plus honour tiles.',
      excludes: ['full_flush', 'all_honours', 'thirteen_orphans', 'nine_gates'],
    },
    {
      id: 'full_flush',
      name: 'Full flush',
      chinese: '清一色',
      tai: 4,
      group: 'shape',
      description: 'One suit only, no honours.',
      excludes: [...HONOUR_SETS, 'half_flush', 'thirteen_orphans'],
    },
    {
      id: 'concealed',
      name: 'Fully concealed hand',
      chinese: '門前清',
      tai: 1,
      group: 'shape',
      description: 'No pungs, chows or kongs claimed from discards. Concealed kongs are fine.',
    },
    {
      id: 'small_three_dragons',
      name: 'Small three dragons',
      chinese: '小三元',
      tai: 4,
      group: 'shape',
      description: 'Two dragon pungs and a dragon pair.',
      excludes: ['big_three_dragons', 'small_four_winds', 'big_four_winds'],
    },

    // How you won
    {
      id: 'last_tile',
      name: 'Win on the last tile',
      chinese: '海底撈月',
      tai: 1,
      group: 'winning',
      description: 'Winning on the last tile of the wall, or on its discard.',
    },
    {
      id: 'kong_replacement',
      name: 'Win on a kong replacement',
      chinese: '槓上開花',
      tai: 1,
      group: 'winning',
      description: 'Drawing your winning tile as the replacement after declaring a kong.',
      requires: { winType: 'selfDraw' },
    },
    {
      id: 'robbing_kong',
      name: 'Robbing a kong',
      chinese: '搶槓',
      tai: 1,
      group: 'winning',
      description: 'Winning on the tile someone adds to their exposed pung. Pick them as the discarder.',
      requires: { winType: 'discard' },
      excludes: ['kong_replacement', 'last_tile'],
    },

    // Limit hands (score the max)
    {
      id: 'big_three_dragons',
      name: 'Big three dragons',
      chinese: '大三元',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'Pungs of all three dragons.',
      excludes: ['small_four_winds', 'big_four_winds'],
    },
    {
      id: 'small_four_winds',
      name: 'Small four winds',
      chinese: '小四喜',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'Three wind pungs and a pair of the fourth wind.',
      excludes: ['big_four_winds'],
      // Three wind pungs and a wind pair leave room for one more set.
      caps: { dragon_pung: 1 },
    },
    {
      id: 'big_four_winds',
      name: 'Big four winds',
      chinese: '大四喜',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'Pungs of all four winds.',
      excludes: ['robbing_kong'],
    },
    {
      id: 'all_honours',
      name: 'All honours',
      chinese: '字一色',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'Only winds and dragons.',
      excludes: ['thirteen_orphans', 'nine_gates', 'robbing_kong'],
    },
    {
      id: 'thirteen_orphans',
      name: 'Thirteen orphans',
      chinese: '十三幺',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'One each of every 1, 9, wind and dragon, plus a second of any of them.',
      // No sets at all, and tiles from every suit.
      excludes: [...HONOUR_SETS, 'nine_gates', 'kong_replacement'],
    },
    {
      id: 'nine_gates',
      name: 'Nine gates',
      chinese: '九蓮寶燈',
      tai: 0,
      limit: true,
      group: 'limit',
      description: '1112345678999 of one suit, fully concealed, plus any tile of that suit.',
      // One suit, fully concealed, and it already holds at least one of every tile you could rob.
      excludes: [...HONOUR_SETS, 'robbing_kong', 'kong_replacement'],
    },
    {
      id: 'heavenly_hand',
      name: 'Heavenly hand',
      chinese: '天胡',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'The dealer wins on the tiles dealt.',
      requires: { winType: 'selfDraw', dealer: true },
      excludes: ['earthly_hand', 'last_tile', 'kong_replacement', 'robbing_kong'],
    },
    {
      id: 'earthly_hand',
      name: 'Earthly hand',
      chinese: '地胡',
      tai: 0,
      limit: true,
      group: 'limit',
      description: 'A non-dealer wins on the first turn, before any tile is claimed.',
      requires: { dealer: false },
      excludes: ['last_tile', 'kong_replacement', 'robbing_kong'],
    },
  ],
};
