import type { RotationRules } from '../game/winds';

export type WinType = 'discard' | 'selfDraw';

export type PatternGroup = 'bonus' | 'sets' | 'shape' | 'winning' | 'limit';

export interface PatternDef {
  id: string;
  name: string;
  /** For naming a winning hand in the history, e.g. "Own flower" for "Own flower or season". */
  shortName?: string;
  chinese?: string;
  /** Tai (or faan, or han) per time the pattern is counted. Ignored for limit hands. */
  tai: number;
  /** Han-and-fu rulesets: the value with an open hand. null means the hand must be closed. */
  openTai?: number | null;
  /** A limit hand scores the ruleset's limitTai (or its maximum), and pays the maximum. */
  limit?: boolean;
  /** The tile calculator works this one out from the tiles, so it isn't asked about. */
  fromTiles?: boolean;
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
  /** Tai cap. Limit hands pay this. */
  maxTai: number;
  /** What a limit hand counts as, e.g. 13. It still pays as maxTai. Leave it out to use maxTai. */
  limitTai?: number;
  /** maxTai only caps the payout; the hand keeps its full tai (Hong Kong). Off: the tai is capped too. */
  payoutCapOnly?: boolean;
  /**
   * shooterDouble: the discarder pays double, the others pay single (Singapore style).
   * shooterOnly: the discarder pays for the whole table, so the winner gets the same total.
   */
  discard: 'shooterDouble' | 'shooterOnly';
  /** On a self-draw, each of the three other players pays payout x this. */
  selfDrawMultiplier: number;
  /**
   * Points a false win (詐胡) costs, paid to each other player. Leave it out to charge the game's
   * max tai as points: 5 each with a 5-tai cap.
   */
  falseWinPoints?: number;
}

/** Settings for Riichi games (han-and-fu scoring). See the TileTalk Riichi & 3-Player Rules Spec. */
export interface RiichiOptions {
  /** hanchan: East and South rounds. tonpuusen: East round only. */
  gameLength: 'hanchan' | 'tonpuusen';
  startingPoints: number;
  returnPoints: number;
  /** In thousands, best place first, one per player. */
  uma: number[];
  /** double: everyone who rons is paid. atamahane: only the winner nearest the discarder. */
  multipleRon: 'double' | 'atamahane';
  /** A player below 0 points ends the game. */
  busting: boolean;
  /** 4 han 30 fu and 3 han 60 fu round up to mangan. */
  kiriageMangan: boolean;
  /** 13+ han scores a yakuman; otherwise it's capped at sanbaiman. */
  kazoeYakuman: boolean;
  nagashiMangan: boolean;
  /** Paid by noten players to tenpai players at an exhaustive draw, in total. */
  tenpaiPayment: number;
  /** Per honba counter. */
  honbaValue: number;
  /** Three players: a tsumo is short the missing North seat's share. Off splits the full value between the two payers. */
  tsumoLoss: boolean;
  /** Riichi sticks still on the table when the game ends. */
  leftoverSticks: 'first' | 'lost';
}

/** Settings chosen for one game when it starts. Anything left out uses the ruleset's default. */
export interface GameOptions {
  /** Tai cap, and what a limit hand scores. */
  maxTai: number;
  /** Smallest hand that can win. */
  minTai: number;
  discard: PaymentRules['discard'];
  players: 3 | 4;
  /** Only for Riichi games. */
  riichi?: RiichiOptions;
}

/** Paid the moment it happens, during the hand, whoever goes on to win. */
export interface ImmediatePayoutDef {
  id: string;
  name: string;
  chinese?: string;
  description: string;
  /**
   * others: each other player pays.
   * discarder: only the player who discarded the tile pays.
   * owner: the player the tiles belong to pays (e.g. whose seat number a flower is). If they're
   * the receiver's own, each other player pays instead.
   */
  payer: 'others' | 'discarder' | 'owner';
  /** Points each paying player pays. */
  amount: number;
}

/** A reference section on the Rules page, for rules that aren't scoring patterns. */
export interface RulesNote {
  title: string;
  body: string;
}

export interface Ruleset {
  id: string;
  name: string;
  description: string;
  /** tai: count tai and double per tai (house). hanFu: Japanese Riichi han and fu. */
  scoringModel: 'tai' | 'hanFu';
  /** What hand values are called in tai scoring: 'tai' (the default) or 'faan'. */
  unit?: 'tai' | 'faan';
  /** Rules page headings, where this ruleset's groups mean something different. */
  groupNames?: Partial<Record<PatternGroup, string>>;
  notes?: RulesNote[];
  /** Han-and-fu rulesets only: default settings for four and three players. */
  riichiDefaults?: { 4: RiichiOptions; 3: RiichiOptions };
  /** 13 for Hong Kong/Singapore/Riichi/MCR, 16 for Taiwanese. Used once tile-based scoring arrives. */
  handSize: 13 | 16;
  patterns: PatternDef[];
  payment: PaymentRules;
  immediatePayouts: ImmediatePayoutDef[];
  rotation: RotationRules;
}
