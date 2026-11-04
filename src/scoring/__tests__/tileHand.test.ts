import { decompose, readTiles, TileReading } from '../tileHand';
import { scoreHand } from '../engine';
import { houseRules } from '../rulesets/houseRules';

const t = (spec: string) =>
  // "123m 456p 789s EE RRR": digits then a suit letter, or honour letters.
  spec.split(' ').flatMap((g) => {
    const suited = /^(\d+)([mps])$/.exec(g);
    if (suited) return [...suited[1]].map((n) => `${{ m: 'man', p: 'pin', s: 'sou' }[suited[2]]}${n}`);
    const honours: Record<string, string> = { E: 'east', S: 'south', W: 'west', N: 'north', R: 'red', G: 'green', H: 'white' };
    return [...g].map((c) => honours[c]);
  });

const east = { seatWind: 0, prevailingWind: 0 };
const ids = (r: TileReading) => (r.ok ? r.patterns.map((p) => (p.count > 1 ? `${p.id}×${p.count}` : p.id)).sort() : r.reason);

describe('decompose', () => {
  test('finds every reading', () => {
    // Three pungs or three chows.
    expect(decompose(t('111222333m 456p 99s'))).toHaveLength(2);
  });

  test('extra tiles must be kongs', () => {
    expect(decompose(t('1111m 234p 567p 789s 99s'))).toHaveLength(1);
    expect(decompose(t('1111m 234p 567p 789s 99s 1s'))).toHaveLength(0);
  });

  test('not a winning hand', () => {
    expect(decompose(t('1357m 2468p 13579s'))).toHaveLength(0);
  });
});

describe('readTiles', () => {
  test('all chows', () => {
    expect(ids(readTiles(houseRules, t('123m 456m 789p 234s 55s'), [], east))).toEqual(['all_chows']);
  });

  test('all pungs with dragons, own wind and own flower', () => {
    const r = readTiles(houseRules, t('111m 999p RRR EEE 55s'), ['flower1', 'season3'], east);
    expect(ids(r)).toEqual(['all_pungs', 'dragon_pung', 'prevailing_wind_pung', 'seat_flower', 'seat_wind_pung']);
    expect(r.ok && scoreHand(houseRules, r.patterns, { winType: 'discard' }).valid).toBe(true);
  });

  test('picks the reading worth the most', () => {
    // 111222333m read as pungs: all pungs + full flush beats chows.
    expect(ids(readTiles(houseRules, t('111222333m 444m 99m'), [], east))).toContain('all_pungs');
  });

  test('half and full flush', () => {
    expect(ids(readTiles(houseRules, t('123m 456m 789m 111m RR'), [], east))).toEqual(['half_flush']);
    expect(ids(readTiles(houseRules, t('123m 456m 789m 111m 55m'), [], east))).toEqual(['full_flush']);
  });

  test('south wind is an honour, not bamboo', () => {
    // Regression: "south" starts with "sou", and was read as a bamboo tile.
    expect(ids(readTiles(houseRules, t('123s 456s 789s SSS 55s'), [], east))).toEqual(['half_flush']);
  });

  test('small three dragons', () => {
    expect(ids(readTiles(houseRules, t('RRR GGG HH 123m 456m'), [], east))).toEqual(['dragon_pung×2', 'half_flush', 'small_three_dragons']);
  });

  test('limit hands', () => {
    expect(ids(readTiles(houseRules, t('RRR GGG HHH 123m 55p'), [], east))).toEqual(['big_three_dragons']);
    expect(ids(readTiles(houseRules, t('222s 333s 444s 666s 88s'), [], east))).toContain('all_green');
    expect(ids(readTiles(houseRules, t('234s 666s GGG 888s 22s'), [], east))).toEqual(['all_green']);
    expect(ids(readTiles(houseRules, t('111m 999m 111p 999s 11s'), [], east))).toEqual(['terminals_only']);
    expect(ids(readTiles(houseRules, t('111m 999p EEE RRR 99s'), [], east))).toEqual(['mixed_terminals']);
    expect(ids(readTiles(houseRules, t('1111m 2222p 3333s 4444s 55m'), [], east))).toEqual(['all_kongs']);
    expect(ids(readTiles(houseRules, t('19m 19p 19s ESWNRGH E'), [], east))).toEqual(['thirteen_orphans']);
    expect(ids(readTiles(houseRules, t('1112345678999m 5m'), [], east))).toEqual(['nine_gates']);
  });

  test('a limit hand counts 13 tai and pays the max', () => {
    const r = readTiles(houseRules, t('RRR GGG HHH 123m 55p'), [], east);
    const score = scoreHand(houseRules, r.ok ? r.patterns : []);
    expect(score.tai).toBe(13);
    expect(score.payout).toBe(16);
  });

  test('seven flowers wins whatever the hand', () => {
    const flowers = ['flower1', 'flower2', 'flower3', 'flower4', 'season1', 'season2', 'season3'];
    expect(ids(readTiles(houseRules, t('19m'), flowers, east))).toEqual(['flower_set', 'flower_win', 'seat_flower×2']);
  });

  test('a seat other than East', () => {
    // South seat in the East round: the south pung is the seat wind, flower 2 is theirs.
    const r = readTiles(houseRules, t('SSS 123m 456p 789s 11s'), ['flower2', 'flower1'], { seatWind: 1, prevailingWind: 0 });
    expect(ids(r)).toEqual(['seat_flower', 'seat_wind_pung']);
  });

  test('says what is wrong', () => {
    expect(readTiles(houseRules, t('123m'), [], east)).toEqual({ ok: false, reason: 'Add 11 more tiles.' });
    expect(readTiles(houseRules, t('1357m 2468p 13579s'), [], east).ok).toBe(false);
  });
});
