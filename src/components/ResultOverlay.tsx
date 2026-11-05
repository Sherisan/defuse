import type { RoundView } from '../game/engine';
import { multiplierFor } from '../game/math';
import { formatMoney, formatMultiplier } from '../game/money';
import { WIRES } from '../game/wires';

export function ResultOverlay({
  round,
  currency,
  visible,
  onClose,
}: {
  round: RoundView | null;
  currency: string;
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible || !round || round.status === 'live' || round.detonator === null) return null;
  const det = WIRES[round.detonator];
  const spent = round.bet + round.tipCost;

  const view = {
    cashed: { title: 'SECURED', amount: `+${formatMoney(round.payout, currency)}`, meta: `Cashed out at ${formatMultiplier(multiplierFor(round.rung))}` },
    defused: { title: 'BOMB DEFUSED', amount: `+${formatMoney(round.payout, currency)}`, meta: `Max win · ${formatMultiplier(multiplierFor(round.rung))}` },
    exploded: { title: 'DETONATED', amount: `−${formatMoney(spent, currency)}`, meta: `Cut #${round.cut.length} hit the detonator` },
  }[round.status];

  return (
    <div className={`result result-${round.status}`} onClick={onClose} role="status">
      <div className="result-card">
        <div className="result-stripe" />
        <div className="result-title">{view.title}</div>
        <div className="result-amount">{view.amount}</div>
        <div className="result-meta">{view.meta}</div>
        <div className="result-det">
          Detonator: <i style={{ background: det.color }} /> {det.name}
        </div>
        <small>Tap to continue</small>
      </div>
    </div>
  );
}
