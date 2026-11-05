import type { RoundView } from '../game/engine';
import { MAX_RUNG, WIRE_COUNT, multiplierFor } from '../game/math';
import { formatMultiplier } from '../game/money';
import { sound } from '../game/sound';
import { WIRES } from '../game/wires';

// ── Geometry (SVG user units, viewBox 720 × 560) ─────────────────────────
const TOP = 236;
const BOT = 468;
const SWAY = [34, -28, 40, -36, 30, -40];

type Pt = [number, number];
const lerp = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const curve = (p: Pt[]) => `M${p[0]} C${p[1]} ${p[2]} ${p[3]}`;

/** Each wire is a cubic split at t = 0.5 so the two halves can spring apart when cut. */
const GEOMETRY = WIRES.map((_, i) => {
  const x = 150 + i * 84;
  const s = SWAY[i];
  const p0: Pt = [x, TOP];
  const p1: Pt = [x + s, TOP + 70];
  const p2: Pt = [x - s, BOT - 70];
  const p3: Pt = [x, BOT];
  const a = lerp(p0, p1);
  const b = lerp(p1, p2);
  const c = lerp(p2, p3);
  const ab = lerp(a, b);
  const bc = lerp(b, c);
  const m = lerp(ab, bc);
  const len = Math.hypot(bc[0] - ab[0], bc[1] - ab[1]);
  const tan: Pt = [(bc[0] - ab[0]) / len, (bc[1] - ab[1]) / len];
  return { x, m, tan, dir: s > 0 ? 1 : -1, full: curve([p0, p1, p2, p3]), top: curve([p0, a, ab, m]), bottom: curve([m, bc, c, p3]) };
});

/** Frayed copper strands at a cut end, fanning out along `dir`. */
function Strands({ at, dir }: { at: Pt; dir: Pt }) {
  return (
    <g className="strands">
      {[-0.5, 0, 0.5].map((spread) => {
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const dx = dir[0] * cos - dir[1] * sin;
        const dy = dir[0] * sin + dir[1] * cos;
        return <line key={spread} x1={at[0]} y1={at[1]} x2={at[0] + dx * 10} y2={at[1] + dy * 10} />;
      })}
    </g>
  );
}

function Tag({ x, y, label, kind }: { x: number; y: number; label: string; kind: 'intel' | 'det' }) {
  return (
    <g className={`tag tag-${kind}`} transform={`translate(${x} ${y})`}>
      <rect x={-36} y={-13} width={72} height={26} rx={13} />
      <text y={5}>{label}</text>
    </g>
  );
}

type WireState = 'idle' | 'cutting' | 'cut' | 'intel';

function Wire({
  index,
  state,
  interactive,
  revealDetonator,
  onCut,
}: {
  index: number;
  state: WireState;
  interactive: boolean;
  revealDetonator: boolean;
  onCut: (i: number) => void;
}) {
  const g = GEOMETRY[index];
  const { color } = WIRES[index];
  const cut = state === 'cut';
  const clickable = interactive && state === 'idle';
  const [mx, my] = g.m;

  return (
    <g
      className={`wire ${state} ${clickable ? 'clickable' : ''} ${revealDetonator ? 'detonator' : ''}`}
      onClick={clickable ? () => onCut(index) : undefined}
      onMouseEnter={clickable ? sound.hover : undefined}
      role={clickable ? 'button' : undefined}
      aria-label={clickable ? `Cut the ${WIRES[index].name.toLowerCase()} wire` : undefined}
    >
      <path className="wire-hit" d={g.full} />
      {state === 'intel' && <path className="wire-intel-glow" d={g.full} />}
      {revealDetonator && <path className="wire-det-glow" d={g.full} />}
      <g className="wire-body" style={{ ['--wire' as string]: color }}>
        <g
          className="wire-half"
          style={{ transformOrigin: `${g.x}px ${TOP}px`, transform: cut ? `rotate(${g.dir * 8}deg) translateY(-8px)` : undefined }}
        >
          <path className="wire-shadow" d={g.top} />
          <path className="wire-core" d={g.top} />
          <path className="wire-shine" d={g.top} />
          {cut && <Strands at={g.m} dir={g.tan} />}
        </g>
        <g
          className="wire-half"
          style={{ transformOrigin: `${g.x}px ${BOT}px`, transform: cut ? `rotate(${g.dir * 8}deg) translateY(8px)` : undefined }}
        >
          <path className="wire-shadow" d={g.bottom} />
          <path className="wire-core" d={g.bottom} />
          <path className="wire-shine" d={g.bottom} />
          {cut && <Strands at={g.m} dir={[-g.tan[0], -g.tan[1]]} />}
        </g>
      </g>

      {cut && (
        <g className="spark" transform={`translate(${mx} ${my})`}>
          {Array.from({ length: 10 }, (_, k) => {
            const a = (k / 10) * Math.PI * 2;
            return <line key={k} x1={Math.cos(a) * 6} y1={Math.sin(a) * 6} x2={Math.cos(a) * 22} y2={Math.sin(a) * 22} />;
          })}
        </g>
      )}

      <g className="reticle" transform={`translate(${mx} ${my})`}>
        <circle className="reticle-ring" r={26} />
        <path d="M-36 0h12M24 0h12M0 -36v12M0 24v12" />
      </g>

      {state === 'intel' && <Tag x={mx} y={my - 58} label="✓ SAFE" kind="intel" />}
      {revealDetonator && <Tag x={mx} y={my - 58} label="☠ LIVE" kind="det" />}
    </g>
  );
}

function lcdText(round: RoundView | null): { main: string; sub: string; tone: string } {
  if (!round) return { main: 'ARMED', sub: 'PLACE YOUR BET', tone: 'red' };
  const liveWires = WIRE_COUNT - round.rung;
  switch (round.status) {
    case 'live':
      return {
        main: formatMultiplier(multiplierFor(round.rung)),
        sub: `NEXT ${formatMultiplier(multiplierFor(round.rung + 1))} · ODDS 1/${liveWires}`,
        tone: 'amber',
      };
    case 'cashed':
      return { main: 'SECURED', sub: `CASHED AT ${formatMultiplier(multiplierFor(round.rung))}`, tone: 'green' };
    case 'defused':
      return { main: 'DEFUSED', sub: '00:00 · DEVICE SAFE', tone: 'green' };
    case 'exploded':
      return { main: '88:88', sub: 'ERR · SIGNAL LOST', tone: 'red flicker' };
  }
}

export function Bomb({
  round,
  cutting,
  interactive,
  scanKey,
  onCut,
}: {
  round: RoundView | null;
  cutting: number | null;
  interactive: boolean;
  scanKey: number;
  onCut: (i: number) => void;
}) {
  const status = round?.status ?? 'idle';
  const ended = !!round && round.status !== 'live';
  const lcd = lcdText(round);

  const stateOf = (i: number): WireState => {
    if (cutting === i) return 'cutting';
    if (round?.cut.includes(i)) return 'cut';
    if (round?.intel === i) return 'intel';
    return 'idle';
  };

  return (
    <svg className={`bomb status-${status} ${interactive ? 'interactive' : ''}`} viewBox="0 0 720 560" aria-label={`Bomb, ${round?.rung ?? 0} of ${MAX_RUNG} safe wires cleared`}>
      <defs>
        <linearGradient id="casing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262d37" />
          <stop offset="0.55" stopColor="#151a21" />
          <stop offset="1" stopColor="#0c0f13" />
        </linearGradient>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#434c58" />
          <stop offset="0.5" stopColor="#262c34" />
          <stop offset="1" stopColor="#15191e" />
        </linearGradient>
        <linearGradient id="dyn" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a0808" />
          <stop offset="0.35" stopColor="#c42222" />
          <stop offset="0.5" stopColor="#ff6656" />
          <stop offset="0.65" stopColor="#a81a1a" />
          <stop offset="1" stopColor="#3e0606" />
        </linearGradient>
        <radialGradient id="screw" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#9aa4b1" />
          <stop offset="0.6" stopColor="#4b5460" />
          <stop offset="1" stopColor="#20252c" />
        </radialGradient>
        <radialGradient id="soot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <pattern id="hazard" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="20" fill="#ffc400" />
          <rect x="10" width="10" height="20" fill="#111" />
        </pattern>
        <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2" fill="rgba(0,0,0,0.4)" />
        </pattern>
        <filter id="glow" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="lcd-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dynamite bundle behind the casing */}
      <g className="dynamite">
        {[6, 40, 632, 666].map((x) => (
          <rect key={x} x={x} y={70} width={48} height={420} rx={22} fill="url(#dyn)" />
        ))}
        {[120, 410].map((y) => (
          <rect key={y} x={0} y={y} width={720} height={28} rx={4} fill="#2a2e35" stroke="#15181c" />
        ))}
      </g>

      {/* Casing */}
      <rect className="casing" x={50} y={24} width={620} height={512} rx={30} fill="url(#casing)" stroke="#2a3038" strokeWidth={2} />
      <rect x={64} y={38} width={592} height={484} rx={22} fill="none" stroke="rgba(255,255,255,0.05)" />
      <rect x={84} y={46} width={552} height={12} rx={3} fill="url(#hazard)" opacity={0.9} />
      {[
        [84, 86],
        [636, 86],
        [84, 504],
        [636, 504],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy})`}>
          <circle r={9} fill="url(#screw)" stroke="#0b0d10" strokeWidth={1.5} />
          <path d="M-5 0h10M0 -5v10" stroke="#1a1e24" strokeWidth={2} transform="rotate(25)" />
        </g>
      ))}
      <text className="plate" x={110} y={198}>
        DET-6 // MK.II
      </text>
      <text className="plate" x={610} y={198} textAnchor="end">
        HIGH EXPLOSIVE
      </text>

      {/* LCD */}
      <g className={`lcd tone-${lcd.tone}`}>
        <rect x={196} y={72} width={328} height={112} rx={12} fill="#04090a" stroke="#2a3038" strokeWidth={3} />
        <rect x={204} y={80} width={312} height={96} rx={8} className="lcd-screen" />
        <text className="lcd-main" x={360} y={140} filter="url(#lcd-glow)">
          {lcd.main}
        </text>
        <text className="lcd-sub" x={360} y={166}>
          {lcd.sub}
        </text>
        <rect x={204} y={80} width={312} height={96} rx={8} fill="url(#scanlines)" pointerEvents="none" />
      </g>
      <circle className="led" cx={160} cy={112} r={8} />
      <text className="plate small" x={160} y={142} textAnchor="middle">
        ARM
      </text>
      <g className="switches">
        {[548, 578].map((x, i) => (
          <g key={x}>
            <rect x={x} y={94} width={18} height={40} rx={4} fill="#0d1014" stroke="#2a3038" />
            <rect x={x + 3} y={i ? 114 : 98} width={12} height={16} rx={2} fill="#59626e" />
          </g>
        ))}
      </g>

      {/* Blast damage sits under the wires so the detonator reveal stays readable */}
      {status === 'exploded' && (
        <g className="damage" pointerEvents="none">
          <ellipse cx={360} cy={330} rx={300} ry={220} fill="url(#soot)" />
          <path d="M360 300l-60-80-30 10M360 300l90-60 40 20M360 300l-110 70-60-10M360 300l40 120 50 30M360 300l130 60" />
        </g>
      )}

      {/* Terminal blocks */}
      <rect x={96} y={TOP - 22} width={528} height={34} rx={8} fill="url(#bar)" stroke="#0b0d10" />
      <rect x={96} y={BOT - 12} width={528} height={34} rx={8} fill="url(#bar)" stroke="#0b0d10" />

      <g filter="url(#glow)" className="wires">
        {WIRES.map((_, i) => (
          <Wire
            key={i}
            index={i}
            state={stateOf(i)}
            interactive={interactive}
            revealDetonator={ended && round!.detonator === i}
            onCut={onCut}
          />
        ))}
      </g>

      {GEOMETRY.map((g, i) => (
        <g key={i}>
          <circle cx={g.x} cy={TOP} r={10} fill="url(#screw)" stroke="#0b0d10" />
          <circle cx={g.x} cy={BOT} r={10} fill="url(#screw)" stroke="#0b0d10" />
          <circle cx={g.x - 14} cy={BOT + 46} r={5} fill={WIRES[i].color} />
          <text className="wire-num" x={g.x + 4} y={BOT + 51}>
            {i + 1}
          </text>
        </g>
      ))}

      {scanKey > 0 && <rect key={scanKey} className="scan" x={96} y={TOP} width={528} height={4} />}

      {status === 'defused' && (
        <g className="rings" pointerEvents="none">
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={360} cy={352} r={60} style={{ animationDelay: `${k * 0.35}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}
