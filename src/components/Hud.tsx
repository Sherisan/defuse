import { formatMoney } from '../game/money';
import { ClockIcon, HelpIcon, ShieldIcon, SoundIcon } from './Icons';

export function Logo() {
  return (
    <div className="logo" aria-label="Defuse">
      <span>DEF</span>
      <svg className="logo-u" viewBox="0 0 34 44" aria-hidden>
        <path d="M5 3v22c0 8 4 13 9 14" />
        <path d="M29 3v22c0 8-4 13-9 14" />
        <path className="logo-copper" d="M14 39l2-3M14 39l2 2M20 39l-2-3M20 39l-2 2" />
      </svg>
      <span>SE</span>
    </div>
  );
}

export function Hud({
  balance,
  currency,
  muted,
  onToggleSound,
  onRules,
  onHistory,
  onFairness,
}: {
  balance: number;
  currency: string;
  muted: boolean;
  onToggleSound: () => void;
  onRules: () => void;
  onHistory: () => void;
  onFairness: () => void;
}) {
  return (
    <header className="hud">
      <Logo />
      <div className="hud-right">
        <div className="balance">
          <span className="balance-label">BALANCE</span>
          <span className="balance-value">{formatMoney(balance, currency)}</span>
        </div>
        <button className="icon-btn" onClick={onFairness} aria-label="Provably fair" title="Provably fair">
          <ShieldIcon />
        </button>
        <button className="icon-btn" onClick={onHistory} aria-label="Bet history" title="Bet history">
          <ClockIcon />
        </button>
        <button className="icon-btn" onClick={onRules} aria-label="How to play" title="How to play">
          <HelpIcon />
        </button>
        <button className="icon-btn" onClick={onToggleSound} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
          <SoundIcon muted={muted} />
        </button>
      </div>
    </header>
  );
}
