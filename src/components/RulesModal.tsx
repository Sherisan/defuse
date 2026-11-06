import { LADDER, MAX_RUNG, RTP, WIRE_COUNT, tipFraction } from '../game/math';
import { formatMultiplier } from '../game/money';
import { Modal } from './Modal';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="HOW TO PLAY" onClose={onClose}>
      <ol className="rules-steps">
        <li>
          <b>Arm the bomb.</b> Pick a bet and press <kbd>ARM BOMB</kbd>.
        </li>
        <li>
          <b>Cut wires.</b> {WIRE_COUNT} wires, one is the detonator. Every safe cut moves you up the ladder.
        </li>
        <li>
          <b>Cash out</b> any time after your first safe cut, or clear all {MAX_RUNG} safe wires to defuse the bomb for the max win.
        </li>
        <li>
          <b>Cut the detonator</b> and the bomb goes off. The bet is lost.
        </li>
      </ol>

      <h4>Payout ladder</h4>
      <table className="rules-table">
        <thead>
          <tr>
            <th>Safe wires</th>
            <th>Chance</th>
            <th>Pays</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((m, i) => (
            <tr key={i}>
              <td>{i + 1 === MAX_RUNG ? `${i + 1} · Defuse` : i + 1}</td>
              <td>{(((WIRE_COUNT - i - 1) / WIRE_COUNT) * 100).toFixed(1)}%</td>
              <td>{formatMultiplier(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Bomb Squad Tip</h4>
      <p>
        Once per round you can buy intel: one safe wire is marked and counts as a cleared wire, moving you up a rung without the
        risk. The price depends on how many wires are still live:
      </p>
      <table className="rules-table">
        <thead>
          <tr>
            <th>Live wires</th>
            {[6, 5, 4, 3, 2].map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tip cost</td>
            {[6, 5, 4, 3, 2].map((n) => (
              <td key={n}>{(tipFraction(WIRE_COUNT - n) * 100).toFixed(1)}%</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="muted">
        The tip costs what the extra rung is worth, so the return to player is {(RTP * 100).toFixed(2)}% with or without it. Keyboard: <kbd>1</kbd>–
        <kbd>6</kbd> cut, <kbd>Space</kbd> bet / cash out, <kbd>T</kbd> tip.
      </p>
    </Modal>
  );
}
