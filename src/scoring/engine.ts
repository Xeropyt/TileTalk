import type { ClaimedPattern, HandContext, ImmediatePayoutDef, PatternDef, PaymentRules, Ruleset, WinType } from './types';

export interface ScoreLine {
  id: string;
  name: string;
  count: number;
  tai: number;
  limit: boolean;
}

export interface ScoreResult {
  valid: boolean;
  errors: string[];
  lines: ScoreLine[];
  /** Tai before the cap is applied. */
  rawTai: number;
  /** Tai after the cap. A limit hand counts as limitTai, but pays as the cap. */
  tai: number;
  isLimit: boolean;
  capped: boolean;
  /** Points one player pays at single rate. */
  payout: number;
}

export function findPattern(ruleset: Ruleset, id: string): PatternDef | undefined {
  return ruleset.patterns.find((p) => p.id === id);
}

/**
 * Returns the claimed pattern that prevents `id` from being claimed, if any: one that excludes it,
 * or one already counted more times than `id` would allow.
 */
export function blockedBy(ruleset: Ruleset, claimed: ClaimedPattern[], id: string): PatternDef | null {
  const target = findPattern(ruleset, id);
  for (const c of claimed) {
    if (c.count <= 0 || c.id === id) continue;
    const other = findPattern(ruleset, c.id);
    if (!other) continue;
    if (other.excludes?.includes(id) || target?.excludes?.includes(other.id)) return other;
    const cap = target?.caps?.[other.id];
    if (cap !== undefined && c.count > cap) return other;
  }
  return null;
}

/** Every pattern that can never be claimed with `id`, in ruleset order. */
export function clashesWith(ruleset: Ruleset, id: string): PatternDef[] {
  return ruleset.patterns.filter((p) => p.id !== id && blockedBy(ruleset, [{ id: p.id, count: 1 }], id) === p);
}

/** How many times `id` can be counted alongside the other claimed patterns, and which one lowered it. */
export function maxCountFor(
  ruleset: Ruleset,
  claimed: ClaimedPattern[],
  id: string,
): { max: number; cappedBy: PatternDef | null } {
  let max = findPattern(ruleset, id)?.maxCount ?? 1;
  let cappedBy: PatternDef | null = null;
  for (const c of claimed) {
    if (c.count <= 0 || c.id === id) continue;
    const other = findPattern(ruleset, c.id);
    const cap = other?.caps?.[id];
    if (other && cap !== undefined && cap < max) {
      max = cap;
      cappedBy = other;
    }
  }
  return { max, cappedBy };
}

/** Why the pattern doesn't fit how the hand was won, if it doesn't. */
export function contextProblem(def: PatternDef, context: HandContext): string | null {
  const req = def.requires;
  if (!req) return null;
  if (req.winType && context.winType && req.winType !== context.winType) {
    return req.winType === 'selfDraw' ? 'Self-drawn only' : 'Off a discard only';
  }
  if (req.dealer !== undefined && context.isDealer !== undefined && req.dealer !== context.isDealer) {
    return req.dealer ? 'Dealer only' : 'Not for the dealer';
  }
  return null;
}

/** 1 tai pays the base, and every extra tai doubles it, up to the cap. */
export function taiToPayout(tai: number, payment: PaymentRules): number {
  const capped = Math.min(Math.max(tai, 1), payment.maxTai);
  return payment.basePoints * 2 ** (capped - 1);
}

export function scoreHand(ruleset: Ruleset, claimed: ClaimedPattern[], context: HandContext = {}): ScoreResult {
  const errors: string[] = [];
  const lines: ScoreLine[] = [];
  const reportedConflicts = new Set<string>();
  const active = claimed.filter((c) => c.count > 0);
  let rawTai = 0;
  let isLimit = false;

  for (const c of active) {
    const def = findPattern(ruleset, c.id);
    if (!def) {
      errors.push(`Unknown pattern: ${c.id}`);
      continue;
    }

    const { max, cappedBy } = maxCountFor(ruleset, active, c.id);
    if (c.count > max) {
      const times = max === 1 ? 'once' : `${max} times`;
      errors.push(`${def.name} can only be counted ${times}${cappedBy ? ` with ${cappedBy.name}` : ''}.`);
    }

    for (const o of active) {
      const other = o.id === c.id ? undefined : findPattern(ruleset, o.id);
      if (!other || !(def.excludes?.includes(other.id) || other.excludes?.includes(def.id))) continue;
      const key = [def.id, other.id].sort().join('|');
      if (!reportedConflicts.has(key)) {
        reportedConflicts.add(key);
        errors.push(`${def.name} can't be combined with ${other.name}.`);
      }
    }

    const problem = contextProblem(def, context);
    if (problem) errors.push(`${def.name} is ${problem.toLowerCase()}.`);

    const count = Math.min(c.count, max);
    if (def.limit) isLimit = true;
    const tai = def.limit ? 0 : def.tai * count;
    rawTai += tai;
    lines.push({ id: def.id, name: def.name, count, tai, limit: !!def.limit });
  }

  const { maxTai, minTai } = ruleset.payment;
  const uncapped = !!ruleset.payment.payoutCapOnly;
  const tai = isLimit ? (ruleset.payment.limitTai ?? maxTai) : uncapped ? rawTai : Math.min(rawTai, maxTai);
  const capped = !isLimit && !uncapped && rawTai > maxTai;
  if (tai < minTai) errors.push(`A winning hand needs at least ${minTai} ${ruleset.unit ?? 'tai'}.`);

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    lines,
    rawTai,
    tai,
    isLimit,
    capped,
    payout: valid ? taiToPayout(tai, ruleset.payment) : 0,
  };
}

/**
 * Points for an immediate payout, such as a kong. Always sums to zero. Discarder- and owner-pays
 * payouts need `payerId`; for owner-pays, the receiver's own tiles mean everyone else pays.
 */
export function immediatePayments(
  def: ImmediatePayoutDef,
  playerIds: string[],
  receiverId: string,
  payerId: string | null,
): Record<string, number> {
  const deltas: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  if (def.payer !== 'others' && !payerId) {
    throw new Error(def.payer === 'discarder' ? 'Choose who discarded the tile.' : 'Choose whose seat it is.');
  }
  const everyone = def.payer === 'others' || (def.payer === 'owner' && payerId === receiverId);
  const payers = everyone ? playerIds.filter((id) => id !== receiverId) : [payerId];
  for (const id of payers) {
    if (!id || id === receiverId || !(id in deltas)) throw new Error('Choose who pays.');
    deltas[id] -= def.amount;
    deltas[receiverId] += def.amount;
  }
  return deltas;
}

/** What a false win costs: the player pays this to each other player. */
export function falseWinPenalty(payment: PaymentRules): number {
  // The max tai as points, not a max-tai payout: 5 each with a 5-tai cap, not 16.
  return payment.falseWinPoints ?? payment.maxTai;
}

/** Points for a false win: the offender pays the penalty to everyone else. Always sums to zero. */
export function falseWinPayments(playerIds: string[], offenderId: string, payment: PaymentRules): Record<string, number> {
  const penalty = falseWinPenalty(payment);
  const deltas: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  for (const id of playerIds) {
    if (id === offenderId) continue;
    deltas[id] += penalty;
    deltas[offenderId] -= penalty;
  }
  return deltas;
}

/** Points won (+) and lost (-) by each player for one winning hand. Always sums to zero. */
export function calculatePayments(args: {
  playerIds: string[];
  winnerId: string;
  winType: WinType;
  discarderId: string | null;
  payout: number;
  payment: PaymentRules;
}): Record<string, number> {
  const { playerIds, winnerId, winType, discarderId, payout, payment } = args;
  const deltas: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const others = playerIds.filter((id) => id !== winnerId);

  const pay = (from: string, amount: number) => {
    deltas[from] -= amount;
    deltas[winnerId] += amount;
  };

  if (winType === 'selfDraw') {
    for (const id of others) pay(id, payout * payment.selfDrawMultiplier);
    return deltas;
  }

  if (!discarderId || !others.includes(discarderId)) {
    throw new Error('Choose who discarded the winning tile.');
  }

  if (payment.discard === 'shooterOnly') {
    // The discarder covers the whole table: what everyone would have paid, the double included.
    pay(discarderId, payout * 2 + payout * (others.length - 1));
  } else {
    for (const id of others) pay(id, id === discarderId ? payout * 2 : payout);
  }
  return deltas;
}
