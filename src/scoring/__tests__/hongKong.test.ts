import { HONG_KONG_DEFAULTS, hongKongPayout, HongKongHand, HongKongMeld, scoreHongKong } from '../hongKong';
import { scoreHand } from '../engine';
import { formatHandValue } from '../index';
import { houseRules } from '../rulesets/houseRules';
import { hongKongRules } from '../rulesets/hongKong';
import { HONG_KONG_TABLE } from '../rulesets/hongKongConfig';

// "123m 456p 789s EE RRR": digits then a suit letter, or honour letters (E S W N, R G H dragons).
const HONOURS: Record<string, string> = { E: 'east', S: 'south', W: 'west', N: 'north', R: 'red', G: 'green', H: 'white' };
const t = (spec: string) =>
  spec.split(' ').flatMap((g) => {
    const suited = /^(\d+)([mps])$/.exec(g);
    if (suited) return [...suited[1]].map((n) => `${{ m: 'man', p: 'pin', s: 'sou' }[suited[2]]}${n}`);
    return [...g].map((c) => HONOURS[c]);
  });
const tile = (code: string) => t(code)[0];
const chow = (low: string): HongKongMeld => ({ kind: 'chow', tile: tile(low) });
const pung = (code: string): HongKongMeld => ({ kind: 'pung', tile: tile(code) });
const kong = (code: string, concealed = false): HongKongMeld => ({ kind: 'kong', tile: tile(code), concealed });

const ALL_FLOWERS = ['flower1', 'flower2', 'flower3', 'flower4', 'season1', 'season2', 'season3', 'season4'];

/**
 * South seat in the East round, winning on a discard, holding East's flower (not their own), so
 * no wind, no-flower or own-flower faan creep in unless a case asks for them.
 */
const hand = (h: Partial<HongKongHand>): HongKongHand => ({
  tiles: [],
  melds: [],
  flowers: ['flower1'],
  winType: 'discard',
  seatWind: 1,
  prevailingWind: 0,
  isDealer: false,
  ...h,
});

// A melded hand with no patterns of its own: chow, pung and chows in mixed suits.
const PLAIN = { melds: [chow('1m'), pung('2p')], tiles: t('456p 678s 99s') };

const lines = (h: HongKongHand, config = HONG_KONG_DEFAULTS) => {
  const score = scoreHongKong(h, config);
  return { ids: score.patterns.map((p) => (p.count > 1 ? `${p.id}×${p.count}` : p.id)).sort(), faan: score.faan, score };
};
const withChoices = (choices: Partial<typeof HONG_KONG_DEFAULTS.choices>) => ({
  ...HONG_KONG_DEFAULTS,
  choices: { ...HONG_KONG_DEFAULTS.choices, ...choices },
});

describe('every scoring entry', () => {
  const cases: [string, HongKongHand, string[], number][] = [
    // 1 faan
    ['self_drawn', hand({ ...PLAIN, winType: 'selfDraw' }), ['self_drawn'], 1],
    ['concealed', hand({ tiles: t('123m 456m 222p 678s 99s') }), ['concealed'], 1],
    ['all_chows', hand({ melds: [chow('1m')], tiles: t('456m 234p 678s 99s') }), ['all_chows'], 1],
    ['dragon_pung', hand({ melds: [pung('R'), chow('1m')], tiles: t('456p 222s 99p') }), ['dragon_pung'], 1],
    ['seat_wind', hand({ melds: [pung('S'), chow('1m')], tiles: t('456p 222s 99p') }), ['seat_wind'], 1],
    ['prevailing_wind', hand({ melds: [pung('E'), chow('1m')], tiles: t('456p 222s 99p') }), ['prevailing_wind'], 1],
    ['no_flowers', hand({ ...PLAIN, flowers: [] }), ['no_flowers'], 1],
    ['own_flower', hand({ ...PLAIN, flowers: ['flower2', 'season2'] }), ['own_flower×2'], 2],
    [
      'kong_replacement',
      hand({ melds: [kong('2p'), chow('1m')], tiles: t('456p 678s 99s'), winType: 'selfDraw', kongReplacement: true }),
      ['kong_replacement', 'self_drawn'],
      2,
    ],
    ['robbing_kong', hand({ ...PLAIN, robbingKong: true }), ['robbing_kong'], 1],
    ['last_tile', hand({ ...PLAIN, winType: 'selfDraw', lastTile: true }), ['last_tile', 'self_drawn'], 2],
    // Mixed terminals is always all pungs too (or seven pairs, or thirteen orphans): 1 + 3.
    ['mixed_terminals', hand({ melds: [pung('1m'), pung('9p')], tiles: t('111s NNN 99m') }), ['all_pungs', 'mixed_terminals'], 4],

    // Mid-value
    // A full set includes the South seat's own flower 2, which stacks.
    ['flower_set', hand({ ...PLAIN, flowers: ['flower1', 'flower2', 'flower3', 'flower4'] }), ['flower_set', 'own_flower'], 3],
    ['all_pungs', hand({ melds: [pung('2m'), pung('5p')], tiles: t('777s 333m 88p') }), ['all_pungs'], 3],
    ['mixed_one_suit', hand({ melds: [chow('1m'), pung('N')], tiles: t('456m 789m 55m') }), ['mixed_one_suit'], 3],
    ['seven_pairs', hand({ tiles: t('11m 33m 55p 77p 22s 66s NN') }), ['concealed', 'seven_pairs'], 5],
    ['small_three_dragons', hand({ melds: [pung('R'), pung('G')], tiles: t('HH 123m 456p') }), ['small_three_dragons'], 5],
    // Three wind pungs and a wind pair leave one suited set, so this is always mixed one suit too.
    ['small_four_winds', hand({ melds: [pung('E'), pung('S'), pung('W')], tiles: t('NN 123m') }), ['mixed_one_suit', 'small_four_winds'], 9],
    ['full_flush', hand({ melds: [chow('1m'), pung('5m')], tiles: t('456m 789m 22m') }), ['full_flush'], 7],
    ['great_three_dragons', hand({ melds: [pung('R'), pung('G'), pung('H')], tiles: t('123m 55p') }), ['great_three_dragons'], 8],

    // Limit hands
    ['thirteen_orphans', hand({ tiles: t('19m 19p 19s ESWNRGH 1m') }), ['thirteen_orphans'], 13],
    ['great_four_winds', hand({ melds: [pung('E'), pung('S'), pung('W'), pung('N')], tiles: t('55m') }), ['great_four_winds'], 13],
    ['all_honours', hand({ melds: [pung('E'), pung('R')], tiles: t('NNN GGG WW') }), ['all_honours'], 13],
    ['all_terminals', hand({ melds: [pung('1m'), pung('9m')], tiles: t('111p 999s 11s') }), ['all_terminals'], 13],
    ['four_concealed_pungs', hand({ tiles: t('222m 555p 777s NNN 33m'), winType: 'selfDraw' }), ['four_concealed_pungs'], 13],
    ['four_kongs', hand({ melds: [kong('2m'), kong('5p'), kong('7s'), kong('N')], tiles: t('33m') }), ['four_kongs'], 13],
    ['nine_gates', hand({ tiles: t('1112345678999m 5m') }), ['nine_gates'], 13],
    ['heavenly_hand', hand({ tiles: t('123m 456m 222p 678s 99s'), winType: 'selfDraw', isDealer: true, heavenly: true }), ['heavenly_hand'], 13],
    ['earthly_hand', hand({ tiles: t('123m 456m 222p 678s 99s'), earthly: true }), ['earthly_hand'], 13],
    ['all_eight_flowers', hand({ tiles: t('123m'), flowers: ALL_FLOWERS, winType: 'selfDraw' }), ['all_eight_flowers'], 13],
    ['seven_robbing_one', hand({ tiles: t('123m'), flowers: ALL_FLOWERS }), ['seven_robbing_one'], 13],
  ];

  test('there is a case for every entry in the table', () => {
    expect(cases.map((c) => c[0]).sort()).toEqual(HONG_KONG_TABLE.map((e) => e.id).sort());
  });

  test.each(cases)('%s', (_id, h, ids, faan) => {
    const r = lines(h);
    expect(r.ids).toEqual(ids);
    expect(r.faan).toBe(faan);
  });

  // The record screen can also pick patterns by hand, scored by the shared engine.
  test.each(cases)('%s scores the same when its patterns are picked by hand', (_id, h) => {
    const detected = scoreHongKong(h);
    const picked = scoreHand(
      hongKongRules,
      detected.patterns.map((p) => ({ id: p.id, count: p.count })),
      { winType: h.winType, isDealer: h.isDealer },
    );
    expect(picked.tai).toBe(detected.faan);
    expect(picked.valid).toBe(detected.valid);
    expect(picked.payout).toBe(detected.payout);
  });
});

describe('combinations', () => {
  test('full flush + all pungs = 10', () => {
    const r = lines(hand({ melds: [pung('2m'), pung('5m')], tiles: t('777m 999m 33m') }));
    expect(r.ids).toEqual(['all_pungs', 'full_flush']);
    expect(r.faan).toBe(10);
  });

  test('mixed one suit + all pungs + dragon pung = 7', () => {
    // A full flush can't hold a dragon, so the dragon goes with mixed one suit.
    const r = lines(hand({ melds: [pung('2m'), pung('R')], tiles: t('777m 999m 33m') }));
    expect(r.ids).toEqual(['all_pungs', 'dragon_pung', 'mixed_one_suit']);
    expect(r.faan).toBe(7);
  });

  test('a wind that is both seat and prevailing scores both', () => {
    const r = lines(hand({ melds: [pung('E'), chow('1m')], tiles: t('456p 222s 99p'), seatWind: 0, flowers: ['flower2'] }));
    expect(r.ids).toEqual(['prevailing_wind', 'seat_wind']);
    expect(r.faan).toBe(2);
  });

  test('seven pairs + full flush + concealed = 12', () => {
    const r = lines(hand({ tiles: t('11m 22m 44m 55m 77m 88m 99m') }));
    expect(r.ids).toEqual(['concealed', 'full_flush', 'seven_pairs']);
    expect(r.faan).toBe(12);
  });

  test('all chows + concealed + own flower + self-drawn stack', () => {
    const r = lines(hand({ tiles: t('123m 456m 234p 678s 99s'), winType: 'selfDraw', flowers: ['season2'] }));
    expect(r.ids).toEqual(['all_chows', 'own_flower', 'self_drawn']);
    expect(r.faan).toBe(3);
  });
});

describe('exclusions', () => {
  test('full flush replaces mixed one suit', () => {
    expect(lines(hand({ melds: [chow('1m'), pung('5m')], tiles: t('456m 789m 22m') })).ids).not.toContain('mixed_one_suit');
  });

  test('great three dragons replaces small three dragons, and dragon pungs are in the 8', () => {
    const r = lines(hand({ melds: [pung('R'), pung('G'), pung('H')], tiles: t('123m 55p') }));
    expect(r.ids).not.toContain('small_three_dragons');
    expect(r.ids).not.toContain('dragon_pung');
  });

  test('great four winds replaces small four winds', () => {
    expect(lines(hand({ melds: [pung('E'), pung('S'), pung('W'), pung('N')], tiles: t('55m') })).ids).toEqual(['great_four_winds']);
  });

  test('a limit hand ignores every other pattern', () => {
    // Great three dragons, all pungs, own flowers and a self-draw would all count, but all honours is a limit.
    const r = lines(
      hand({ melds: [pung('R'), pung('G'), pung('H')], tiles: t('EEE SS'), winType: 'selfDraw', flowers: ['flower2', 'season2'] }),
    );
    expect(r.ids).toEqual(['all_honours']);
    expect(r.faan).toBe(13);
  });

  test('four concealed pungs does not also score all pungs', () => {
    expect(lines(hand({ tiles: t('222m 555p 777s NNN 33m'), winType: 'selfDraw' })).ids).not.toContain('all_pungs');
  });

  test('all chows never with a pung or kong', () => {
    const r = lines(hand({ melds: [chow('1m'), kong('5p')], tiles: t('234p 678s 99s') }));
    expect(r.ids).not.toContain('all_chows');
  });

  test('no flowers never with own flower or a flower set', () => {
    expect(lines(hand({ ...PLAIN, flowers: ['flower2'] })).ids).not.toContain('no_flowers');
    expect(lines(hand({ ...PLAIN, flowers: [] })).ids).toEqual(['no_flowers']);
  });

  test('seat and prevailing winds are in small four winds', () => {
    // South seat in the East round holds both their winds inside the small four winds.
    const r = lines(hand({ melds: [pung('E'), pung('S'), pung('W')], tiles: t('NN 123m') }));
    expect(r.ids).not.toContain('seat_wind');
    expect(r.ids).not.toContain('prevailing_wind');
  });

  test('a concealed self-draw scores 自摸 but not 門前清', () => {
    expect(lines(hand({ tiles: t('123m 456m 222p 678s 99s'), winType: 'selfDraw' })).ids).toEqual(['self_drawn']);
  });
});

describe('reading the hand', () => {
  test('a hand that reads two ways scores the higher', () => {
    // 111 222 333 as pungs: all pungs + full flush (10). As chows: full flush only (7).
    const r = lines(hand({ melds: [pung('9m')], tiles: t('111222333m 55m') }));
    expect(r.ids).toEqual(['all_pungs', 'full_flush']);
    expect(r.faan).toBe(10);
  });

  test('a discard that completes the pair keeps all four pungs concealed', () => {
    const tiles = t('222m 555p 777s NNN 33m');
    expect(lines(hand({ tiles, winningTile: tile('3m') })).ids).toEqual(['four_concealed_pungs']);
  });

  test('a discard that completes a pung makes it melded', () => {
    const r = lines(hand({ tiles: t('222m 555p 777s NNN 33m'), winningTile: tile('2m') }));
    expect(r.ids).toEqual(['all_pungs', 'concealed']);
    expect(r.faan).toBe(4);
  });

  test('with no winning tile given, a discard is assumed to complete a pung', () => {
    expect(lines(hand({ tiles: t('222m 555p 777s NNN 33m') })).ids).toEqual(['all_pungs', 'concealed']);
  });

  test('a concealed kong keeps the hand concealed; a melded one doesn’t', () => {
    const tiles = t('123m 456m 678s 99s');
    expect(lines(hand({ melds: [kong('2p', true)], tiles })).ids).toEqual(['concealed']);
    expect(lines(hand({ melds: [kong('2p')], tiles })).ids).toEqual([]);
  });

  test('four of a kind in hand is read as a concealed kong', () => {
    expect(lines(hand({ tiles: t('2222p 123m 456m 678s 99s') })).ids).toEqual(['concealed']);
  });

  test('an open hand from the calculator never scores concealed patterns', () => {
    expect(lines(hand({ tiles: t('11m 33m 55p 77p 22s 66s NN'), openHand: true })).score.valid).toBe(false);
    expect(lines(hand({ tiles: t('123m 456m 222p 678s 99s'), openHand: true })).ids).toEqual([]);
  });

  test('situations that can’t apply aren’t counted', () => {
    // Kong replacement needs a kong and a self-draw; robbing a kong needs a discard.
    expect(lines(hand({ ...PLAIN, winType: 'selfDraw', kongReplacement: true })).ids).toEqual(['self_drawn']);
    expect(lines(hand({ ...PLAIN, winType: 'selfDraw', robbingKong: true })).ids).toEqual(['self_drawn']);
    expect(lines(hand({ tiles: t('123m 456m 222p 678s 99s'), heavenly: true })).ids).toEqual(['concealed']);
  });

  test('tiles that aren’t a winning hand', () => {
    const r = scoreHongKong(hand({ tiles: t('1357m 2468p 13579s') }));
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('These tiles don’t make a winning hand.');
  });

  test('too many of one tile', () => {
    expect(scoreHongKong(hand({ melds: [pung('1m')], tiles: t('11m 123p 456p 789p') })).reason).toBe('There are only four of each tile.');
  });
});

describe('minimum faan', () => {
  test('a hand under minFaanToWin is not a win', () => {
    const r = scoreHongKong(hand({ ...PLAIN, robbingKong: true }));
    expect(r.faan).toBe(1);
    expect(r.valid).toBe(false);
    expect(r.payout).toBe(0);
    expect(r.reason).toBe('1 faan is below the 3 needed to win.');
  });

  test('exactly minFaanToWin is a win', () => {
    expect(scoreHongKong(hand({ melds: [pung('2m'), pung('5p')], tiles: t('777s 333m 88p') })).valid).toBe(true);
  });
});

describe('rule choices', () => {
  test('dragon pungs can stack with three dragons', () => {
    const r = lines(hand({ melds: [pung('R'), pung('G')], tiles: t('HH 123m 456p') }), withChoices({ dragonPungsStackWithThreeDragons: true }));
    expect(r.ids).toEqual(['dragon_pung×2', 'small_three_dragons']);
    expect(r.faan).toBe(7);
  });

  test('wind pungs can stack with small four winds', () => {
    const r = lines(hand({ melds: [pung('E'), pung('S'), pung('W')], tiles: t('NN 123m') }), withChoices({ windPungsStackWithSmallFourWinds: true }));
    expect(r.ids).toEqual(['mixed_one_suit', 'prevailing_wind', 'seat_wind', 'small_four_winds']);
    expect(r.faan).toBe(11);
  });

  test('a flower set can replace its own flower', () => {
    const r = lines(hand({ ...PLAIN, flowers: ['flower1', 'flower2', 'flower3', 'flower4'] }), withChoices({ flowerSetStacksWithOwnFlower: false }));
    expect(r.ids).toEqual(['flower_set']);
    expect(r.faan).toBe(2);
  });

  test('seven pairs can be kept apart from flushes', () => {
    const r = lines(hand({ tiles: t('11m 22m 44m 55m 77m 88m 99m') }), withChoices({ sevenPairsWithFlush: false }));
    expect(r.ids).toEqual(['concealed', 'seven_pairs']);
  });

  test('all-honours seven pairs scores as a limit, or as seven pairs', () => {
    const tiles = t('EE SS WW NN RR GG HH');
    expect(lines(hand({ tiles })).ids).toEqual(['all_honours']);
    expect(lines(hand({ tiles }), withChoices({ allHonoursSevenPairsIsLimit: false })).ids).toEqual(['concealed', 'seven_pairs']);
  });

  test('a concealed self-draw can score 門前清 too', () => {
    const r = lines(hand({ tiles: t('123m 456m 222p 678s 99s'), winType: 'selfDraw' }), withChoices({ concealedSelfDrawScoresConcealed: true }));
    expect(r.ids).toEqual(['concealed', 'self_drawn']);
  });

  test('four of a kind in hand makes two of the seven pairs', () => {
    const tiles = t('1111m 33m 55p 77p 22s NN');
    expect(lines(hand({ tiles })).ids).toEqual(['concealed', 'seven_pairs']);
    expect(lines(hand({ tiles }), withChoices({ sevenPairsAllowsFourOfAKind: false })).score.valid).toBe(false);
  });

  test('but not once it’s declared as a kong', () => {
    // The same tiles with the four 1s declared as a concealed kong: a kong plus five pairs isn't a hand.
    const r = scoreHongKong(hand({ melds: [kong('1m', true)], tiles: t('33m 55p 77p 22s NN') }));
    expect(r.valid).toBe(false);
    expect(r.patterns).toEqual([]);
  });

  test('faan values come from the table', () => {
    const table = HONG_KONG_TABLE.map((e) => (e.id === 'small_four_winds' ? { ...e, faan: 'LIMIT' as const } : e));
    const r = lines(hand({ melds: [pung('E'), pung('S'), pung('W')], tiles: t('NN 123m') }), { ...HONG_KONG_DEFAULTS, table });
    expect(r.ids).toEqual(['small_four_winds']);
    expect(r.faan).toBe(13);
  });
});

describe('payout', () => {
  test.each([
    [1, 1],
    [3, 4],
    [8, 128],
    [13, 4096],
  ])('%i faan pays %i', (faan, pay) => {
    expect(hongKongPayout(faan)).toBe(pay);
  });

  test('a limit hand at the default cap of 13 pays 4,096', () => {
    expect(scoreHongKong(hand({ tiles: t('19m 19p 19s ESWNRGH 1m') })).payout).toBe(4096);
  });

  test('the same limit hand with payoutCapFaan = 5 pays 16', () => {
    const capped = { ...HONG_KONG_DEFAULTS, settings: { ...HONG_KONG_DEFAULTS.settings, payoutCapFaan: 5 } };
    const r = scoreHongKong(hand({ tiles: t('19m 19p 19s ESWNRGH 1m') }), capped);
    expect(r.faan).toBe(13);
    expect(r.payoutFaan).toBe(5);
    expect(r.payout).toBe(16);
  });
});

describe('the Hong Kong ruleset in the app', () => {
  test('counts in faan', () => {
    expect(formatHandValue('hongkong', 3)).toBe('3 faan');
    expect(formatHandValue('house', 3)).toBe('3 tai');
  });

  test('has the same immediate payouts and payment rules as House', () => {
    expect(hongKongRules.immediatePayouts).toEqual(houseRules.immediatePayouts);
    expect(hongKongRules.payment.discard).toBe(houseRules.payment.discard);
    expect(hongKongRules.payment.selfDrawMultiplier).toBe(houseRules.payment.selfDrawMultiplier);
    expect(hongKongRules.rotation).toEqual(houseRules.rotation);
  });

  test('keeps its own faan settings', () => {
    expect(hongKongRules.payment.minTai).toBe(3);
    expect(hongKongRules.payment.maxTai).toBe(13);
    expect(hongKongRules.payment.limitTai).toBe(13);
  });
});
