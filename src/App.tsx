import { useEffect, useRef, useState } from 'react';
import { BetPanel } from './components/BetPanel';
import { Bomb } from './components/Bomb';
import { HistoryModal } from './components/HistoryModal';
import { Hud } from './components/Hud';
import { Ladder } from './components/Ladder';
import { ResultOverlay } from './components/ResultOverlay';
import { RulesModal } from './components/RulesModal';
import { createLocalEngine } from './game/engine';
import { createHttpEngine } from './game/httpEngine';
import { MAX_RUNG, WIRE_COUNT, multiplierFor } from './game/math';
import { formatMultiplier } from './game/money';
import { sound } from './game/sound';
import { useGame } from './game/useGame';

// The game API by default; ?demo (or VITE_DEMO=1) plays offline against the in-browser engine with a demo wallet.
const demo = import.meta.env.VITE_DEMO === '1' || new URLSearchParams(window.location.search).has('demo');
const engine = demo ? createLocalEngine() : createHttpEngine();

type ModalKind = 'rules' | 'history' | 'fairness' | null;

export default function App() {
  const game = useGame(engine);
  const { snap, round, phase, busy, cutting, actions } = game;
  const [amount, setAmount] = useState(10);
  const [modal, setModal] = useState<ModalKind>(null);
  const [muted, setMuted] = useState(sound.isMuted());
  const stageRef = useRef<HTMLDivElement>(null);

  const live = phase === 'live';
  const interactive = live && !busy;
  const currency = snap?.currency ?? 'ZAR';

  // Restart the shake animation on every explosion.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || game.boomKey === 0) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }, [game.boomKey]);

  // Keyboard: 1–6 cut, Space bet / cash out, T tip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || (e.target as HTMLElement).tagName === 'INPUT') return;
      const n = Number(e.key);
      if (live && n >= 1 && n <= WIRE_COUNT) {
        const w = n - 1;
        if (!round!.cut.includes(w) && round!.intel !== w) actions.cut(w);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (live) {
          if (round!.rung > 0) actions.cashOut();
        } else actions.bet(amount);
      } else if (live && e.key.toLowerCase() === 't' && round!.intel === null) actions.tip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, live, round, amount, actions]);

  const toggleSound = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  const rung = round?.rung ?? 0;

  return (
    <div className="game-root">
      <Hud
        balance={snap?.balance ?? 0}
        currency={currency}
        muted={muted}
        onToggleSound={toggleSound}
        onRules={() => setModal('rules')}
        onHistory={() => setModal('history')}
        onFairness={() => setModal('fairness')}
      />

      <main className="stage" ref={stageRef}>
        <div className="stage-status">
          {live ? (
            <>
              <span>
                WIRES <b>{rung}</b>/{MAX_RUNG}
              </span>
              <span className="danger">
                ODDS <b>1 IN {WIRE_COUNT - rung}</b>
              </span>
              <span>
                NEXT <b>{formatMultiplier(multiplierFor(rung + 1))}</b>
              </span>
            </>
          ) : (
            <span>{phase === 'ended' ? 'ROUND OVER · ARM A NEW BOMB' : 'SIX WIRES · ONE DETONATOR'}</span>
          )}
        </div>
        <Bomb round={round} cutting={cutting} interactive={interactive} scanKey={game.scanKey} onCut={actions.cut} />
        {live && rung === 0 && cutting === null && <div className="hint">Tap a wire to cut it</div>}
        <ResultOverlay round={round} currency={currency} visible={game.showResult} onClose={actions.dismissResult} />
      </main>

      <Ladder round={round} previewBet={amount} currency={currency} />

      <BetPanel
        phase={phase}
        round={round}
        amount={amount}
        setAmount={setAmount}
        balance={snap?.balance ?? 0}
        currency={currency}
        limits={snap?.limits ?? { minBet: 1, maxBet: 500 }}
        busy={busy}
        onBet={() => actions.bet(amount)}
        onCashOut={actions.cashOut}
        onTip={actions.tip}
        onRefill={actions.refill}
      />

      {game.boomKey > 0 && (
        <div key={game.boomKey} className="boom" aria-hidden>
          <div className="boom-fire" />
          <div className="boom-flash" />
          <svg className="boom-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M48 46L30 20L22 4M48 46L70 28L92 22M48 46L18 58L2 66M48 46L56 76L60 98M48 46L84 62L100 70M30 20L18 26M70 28L74 12M56 76L44 86" />
          </svg>
        </div>
      )}

      {game.error && (
        <div className="toast" role="alert">
          {game.error}
        </div>
      )}

      {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
      {(modal === 'history' || modal === 'fairness') && snap && (
        <HistoryModal
          snap={snap}
          initialTab={modal}
          canChangeSeed={!live}
          onSetClientSeed={actions.setClientSeed}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
