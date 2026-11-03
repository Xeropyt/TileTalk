import type { RotationRules } from '../game/winds';

export type WinType = 'discard' | 'selfDraw';

export type PatternGroup = 'bonus' | 'sets' | 'shape' | 'winning' | 'limit';

export interface PatternDef {
  id: string;
  name: string;
  chinese?: string;
  /** Tai (or faan) per time the pattern is counted. Ignored for limit hands. */
  tai: number;
  /** A limit hand scores the ruleset's maximum tai. */
  limit?: boolean;
  /** How many times the pattern can be counted, e.g. 3 for dragon pungs. Defaults to 1. */
  maxCount?: number;
  group: PatternGroup;
  description?: string;
  /** Pattern ids that can't be claimed together with this one. Works both ways, so list each clash once. */
  excludes?: string[];
  /** Lowers other patterns' maxCount while this one is claimed, e.g. { dragon_pung: 1 }. */
  caps?: Record<string, number>;
  /** Only possible with this win type, or only for (or never for) the dealer. */
  requires?: { winType?: WinType; dealer?: boolean };
}

/** What's known about the win so far. Anything left out isn't checked. */
export interface HandContext {
  winType?: WinType;
  isDealer?: boolean;
}

export interface ClaimedPattern {
  id: string;
  count: number;
}

export interface PaymentRules {
  /** Points paid for a 1-tai hand. Each extra tai doubles it. */
  basePoints: number;
  minTai: number;
  /** Tai cap. Limit hands score this. */
  maxTai: number;
  /**
   * shooterDouble: the discarder pays double, the other two pay single (Singapore style).
   * shooterOnly: only the discarder pays.
   */
  discard: 'shooterDouble' | 'shooterOnly';
  /** On a self-draw, each of the three other players pays payout x this. */
  selfDrawMultiplier: number;
  /** A false win (詐胡) costs the player a hand of this many tai, paid to each of the other three. */
  falseWinTai: number;
}

export interface Ruleset {
  id: string;
  name: string;
  description: string;
  /** 13 for Hong Kong/Singapore/Riichi/MCR, 16 for Taiwanese. Used once tile-based scoring arrives. */
  handSize: 13 | 16;
  patterns: PatternDef[];
  payment: PaymentRules;
  rotation: RotationRules;
}
