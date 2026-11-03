// Seat winds, dealer rotation and dice counting.
// Players are stored in fixed seat order: index 0 starts as East, then South, West, North.

export type Wind = 0 | 1 | 2 | 3;

export const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;
export const WIND_CHARS = ['東', '南', '西', '北'] as const;

export interface TableState {
  dealerIndex: number; // index into session.players of the current dealer
  prevailingWind: Wind; // the round wind
  handNumber: number; // 1-based count of hands in this game
  dealerStreak: number; // how many times the dealer has kept the deal
  finished: boolean;
}

export interface RotationRules {
  dealerStaysOnWin: boolean;
  dealerStaysOnDraw: boolean;
}

export function initialTable(): TableState {
  return { dealerIndex: 0, prevailingWind: 0, handNumber: 1, dealerStreak: 0, finished: false };
}

/** The seat wind of a player, given who is dealer (the dealer is always East). */
export function seatWindOf(playerIndex: number, dealerIndex: number): Wind {
  return ((((playerIndex - dealerIndex) % 4) + 4) % 4) as Wind;
}

/**
 * Works out the table state for the next hand. A replay (after a false win) is the same hand
 * dealt again: the deal and the dealer's streak don't change.
 */
export function nextTableState(
  state: TableState,
  outcome: { dealerWon: boolean; draw: boolean; replay?: boolean },
  rules: RotationRules,
): TableState {
  if (outcome.replay) return { ...state, handNumber: state.handNumber + 1 };

  const dealerStays =
    (outcome.dealerWon && rules.dealerStaysOnWin) || (outcome.draw && rules.dealerStaysOnDraw);

  if (dealerStays) {
    return { ...state, handNumber: state.handNumber + 1, dealerStreak: state.dealerStreak + 1 };
  }

  const dealerIndex = (state.dealerIndex + 1) % 4;
  let prevailingWind = state.prevailingWind;
  let finished = false;

  // The deal has gone all the way round the table: move to the next round wind.
  if (dealerIndex === 0) {
    if (state.prevailingWind === 3) finished = true;
    else prevailingWind = (state.prevailingWind + 1) as Wind;
  }

  return { dealerIndex, prevailingWind, handNumber: state.handNumber + 1, dealerStreak: 0, finished };
}

/**
 * Whose wall to break after a dice roll. Counting starts at the dealer as 1 and goes
 * counter-clockwise: dealer (1, 5, 9...), dealer's right (2, 6, 10...), opposite, then left.
 */
export function wallBreak(total: number, dealerIndex: number): { playerIndex: number; offset: number } {
  const offset = (total - 1) % 4;
  return { playerIndex: (dealerIndex + offset) % 4, offset };
}
