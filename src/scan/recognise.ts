import type { ClaimedPattern } from '../scoring/types';

/** What a scan found: the tiles in the photo, and the scoring patterns they make. */
export interface RecognisedHand {
  /** Tile codes left to right, e.g. '1m' (1 of characters), '5p', '9s', 'E', 'red'. */
  tiles: string[];
  patterns: ClaimedPattern[];
}

/**
 * NEXT STEP: tile recognition isn't connected yet, so this always returns null and the
 * scan screen falls back to scoring the hand by tapping patterns.
 *
 * To connect it, send the photo to a server you control that runs a vision model and
 * returns the tiles. The API key must live on that server, never inside the app. Then
 * turn the tiles into patterns here so the record-hand screen can be pre-filled.
 */
export async function recogniseHand(_photoUri: string): Promise<RecognisedHand | null> {
  return null;
}
