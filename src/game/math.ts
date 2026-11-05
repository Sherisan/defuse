export const WIRE_COUNT = 6;
/** Safe wires to clear before the bomb counts as defused (the last wire left is the detonator). */
export const MAX_RUNG = WIRE_COUNT - 1;
export const RTP = 0.97;

/**
 * A "rung" is the number of safe wires removed so far, whether cut by the player or
 * revealed by the Bomb Squad Tip. Surviving to rung k has probability (6 - k) / 6, so the
 * fair multiplier is 6 / (6 - k). It is scaled by the RTP and floored to 2 dp so rounding
 * never pushes the return above target.
 */
export function multiplierFor(rung: number): number {
  if (rung <= 0) return 1;
  const fair = WIRE_COUNT / (WIRE_COUNT - rung);
  return Math.floor(RTP * fair * 100 + 1e-9) / 100;
}

/** 1.16, 1.45, 1.94, 2.91, 5.82 */
export const LADDER = Array.from({ length: MAX_RUNG }, (_, i) => multiplierFor(i + 1));

export function roundMoney(amount: number): number {
  return Math.round(amount * 100 + 1e-9) / 100;
}

export function payoutFor(bet: number, rung: number): number {
  return roundMoney(bet * multiplierFor(rung));
}

/**
 * Tip price. The tip removes one safe wire and moves the player up one rung for free.
 * With n live wires left that is worth bet / (n - 1), so this is what it costs: 20% at the
 * start, rising to 25%, 33%, 50% and 100% as the bomb gets hotter. Charging the fair price
 * means a round with the tip returns the same 97% as a round without it, whenever it's used.
 */
export function tipCost(bet: number, rung: number): number {
  const liveWires = WIRE_COUNT - rung;
  return Math.ceil((bet * 100) / (liveWires - 1) - 1e-9) / 100;
}
