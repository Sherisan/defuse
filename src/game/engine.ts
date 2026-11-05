import { detonatorFor, intelFor, randomHex, sha256Hex } from './fair';
import { MAX_RUNG, WIRE_COUNT, payoutFor, roundMoney, tipCost } from './math';

export type RoundStatus = 'live' | 'cashed' | 'exploded' | 'defused';

/** What the client is allowed to see of a round. `detonator` stays null until the round is over. */
export interface RoundView {
  id: string;
  bet: number;
  tipCost: number;
  cut: number[];
  intel: number | null;
  rung: number;
  payout: number;
  status: RoundStatus;
  detonator: number | null;
}

export interface Fairness {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface HistoryEntry {
  id: string;
  time: number;
  bet: number;
  tipCost: number;
  cut: number[];
  intel: number | null;
  rung: number;
  payout: number;
  status: Exclude<RoundStatus, 'live'>;
  detonator: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Snapshot {
  balance: number;
  currency: string;
  limits: { minBet: number; maxBet: number };
  fairness: Fairness;
  /** Current round, or the last finished one (kept so the board can show the reveal). */
  round: RoundView | null;
  history: HistoryEntry[];
}

/** The contract a real backend needs to satisfy. Every call returns the full new state. */
export interface DefuseApi {
  init(): Promise<Snapshot>;
  bet(amount: number): Promise<Snapshot>;
  cut(wire: number): Promise<Snapshot>;
  tip(): Promise<Snapshot>;
  cashOut(): Promise<Snapshot>;
  setClientSeed(seed: string): Promise<Snapshot>;
  /** Demo only: top the wallet back up. */
  refill?(): Promise<Snapshot>;
}

interface InternalRound extends Omit<RoundView, 'detonator' | 'rung'> {
  detonator: number;
}

interface Stored {
  balance: number;
  clientSeed: string;
  nonce: number;
  serverSeed: string;
  round: InternalRound | null;
  history: HistoryEntry[];
}

const STORAGE_KEY = 'defuse.demo.v1';
const DEMO_BALANCE = 1000;
const LIMITS = { minBet: 1, maxBet: 500 };
const HISTORY_LIMIT = 50;

/** Safe wires cleared so far: safe cuts plus the tip wire. A detonator cut doesn't count. */
const rungOf = (r: InternalRound) => r.cut.filter((w) => w !== r.detonator).length + (r.intel !== null ? 1 : 0);

/**
 * In-browser stand-in for the game server so the frontend is fully playable without a
 * backend. It holds the secret seed and only exposes the hash until a round ends.
 */
export function createLocalEngine(): DefuseApi {
  let s: Stored = load();
  let seedHash = '';

  function load(): Stored {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Stored;
    } catch {
      /* corrupt storage, start fresh */
    }
    return { balance: DEMO_BALANCE, clientSeed: randomHex(8), nonce: 0, serverSeed: randomHex(), round: null, history: [] };
  }

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));

  async function snapshot(): Promise<Snapshot> {
    seedHash ||= await sha256Hex(s.serverSeed);
    const r = s.round;
    return {
      balance: s.balance,
      currency: 'ZAR',
      limits: LIMITS,
      fairness: { serverSeedHash: seedHash, clientSeed: s.clientSeed, nonce: s.nonce },
      round: r && {
        id: r.id,
        bet: r.bet,
        tipCost: r.tipCost,
        cut: [...r.cut],
        intel: r.intel,
        rung: rungOf(r),
        payout: r.payout,
        status: r.status,
        detonator: r.status === 'live' ? null : r.detonator,
      },
      history: s.history,
    };
  }

  function live(): InternalRound {
    if (s.round?.status !== 'live') throw new Error('No round in progress');
    return s.round;
  }

  /** Close the round, reveal the seed into history and rotate to a fresh one. */
  async function settle(r: InternalRound) {
    s.balance = roundMoney(s.balance + r.payout);
    s.history = [
      {
        id: r.id,
        time: Date.now(),
        bet: r.bet,
        tipCost: r.tipCost,
        cut: [...r.cut],
        intel: r.intel,
        rung: rungOf(r),
        payout: r.payout,
        status: r.status as HistoryEntry['status'],
        detonator: r.detonator,
        serverSeed: s.serverSeed,
        serverSeedHash: await sha256Hex(s.serverSeed),
        clientSeed: s.clientSeed,
        nonce: s.nonce,
      },
      ...s.history,
    ].slice(0, HISTORY_LIMIT);
    s.serverSeed = randomHex();
    s.nonce += 1;
    seedHash = '';
  }

  function checkDefused(r: InternalRound): boolean {
    if (rungOf(r) < MAX_RUNG) return false;
    r.status = 'defused';
    r.payout = payoutFor(r.bet, MAX_RUNG);
    return true;
  }

  return {
    init: snapshot,

    async bet(amount) {
      if (s.round?.status === 'live') throw new Error('Finish the current round first');
      if (!(amount >= LIMITS.minBet && amount <= LIMITS.maxBet)) {
        throw new Error(`Bet must be between ${LIMITS.minBet} and ${LIMITS.maxBet}`);
      }
      amount = roundMoney(amount);
      if (amount > s.balance) throw new Error('Insufficient balance');
      s.balance = roundMoney(s.balance - amount);
      s.round = {
        id: randomHex(6),
        bet: amount,
        tipCost: 0,
        cut: [],
        intel: null,
        payout: 0,
        status: 'live',
        detonator: await detonatorFor(s.serverSeed, s.clientSeed, s.nonce),
      };
      save();
      return snapshot();
    },

    async cut(wire) {
      const r = live();
      if (!Number.isInteger(wire) || wire < 0 || wire >= WIRE_COUNT) throw new Error('Unknown wire');
      if (r.cut.includes(wire) || r.intel === wire) throw new Error('That wire is already clear');
      r.cut.push(wire);
      if (wire === r.detonator) {
        r.status = 'exploded';
        r.payout = 0;
        await settle(r);
      } else if (checkDefused(r)) {
        await settle(r);
      }
      save();
      return snapshot();
    },

    async tip() {
      const r = live();
      if (r.intel !== null) throw new Error('Bomb Squad Tip already used this round');
      const cost = tipCost(r.bet, rungOf(r));
      if (cost > s.balance) throw new Error('Insufficient balance for the tip');
      const candidates = Array.from({ length: WIRE_COUNT }, (_, i) => i).filter(
        (i) => i !== r.detonator && !r.cut.includes(i),
      );
      s.balance = roundMoney(s.balance - cost);
      r.tipCost = cost;
      r.intel = await intelFor(s.serverSeed, s.clientSeed, s.nonce, candidates);
      if (checkDefused(r)) await settle(r);
      save();
      return snapshot();
    },

    async cashOut() {
      const r = live();
      const rung = rungOf(r);
      if (rung === 0) throw new Error('Cut at least one wire first');
      r.status = 'cashed';
      r.payout = payoutFor(r.bet, rung);
      await settle(r);
      save();
      return snapshot();
    },

    async setClientSeed(seed) {
      if (s.round?.status === 'live') throw new Error('Change seeds between rounds');
      const clean = seed.trim().slice(0, 64);
      if (!clean) throw new Error('Client seed cannot be empty');
      s.clientSeed = clean;
      save();
      return snapshot();
    },

    async refill() {
      if (s.round?.status === 'live') throw new Error('Finish the current round first');
      s.balance = DEMO_BALANCE;
      save();
      return snapshot();
    },
  };
}
