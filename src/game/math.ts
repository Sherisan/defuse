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

/** Tip price as a fraction of the bet at this rung: 16.5%, 29.9%, 50.5%, 100%, 300%. */
export function tipFraction(rung: number): number {
  return (multiplierFor(rung + 1) - multiplierFor(rung)) / RTP;
}

/**
 * Tip price. The tip removes one safe wire and moves the player up one rung for free. At rung k the
 * player's position is worth multiplierFor(k) × bet (cashing out and playing on are worth the same
 * on a fair ladder), so the free rung is worth (m(k+1) − m(k)) × bet. Charging that ÷ RTP means
 * every rand spent on the tip returns 97%, whenever it's bought. Rounded up to the cent.
 */
export function tipCost(bet: number, rung: number): number {
  return Math.ceil(bet * tipFraction(rung) * 100 - 1e-9) / 100;
}
