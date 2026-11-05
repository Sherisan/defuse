import { WIRE_COUNT } from './math';

/*
 * Provably fair scheme (the server should implement exactly the same steps):
 *   Before the bet:   the player sees SHA-256(serverSeed).
 *   Detonator wire:   pick(HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`), 6)
 *   Tip wire:         candidates[pick(HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:intel`), candidates.length)]
 *                     where candidates = uncut safe wires in ascending order
 *   After the round:  serverSeed is revealed so the player can recompute both values.
 * pick(digest, n) = (first 52 bits of the digest × n) >> 52, in integers.
 *
 * crypto.subtle needs a secure context: localhost or https.
 */

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return toHex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

/** (top 52 bits of the digest × n) >> 52, in integers so it matches the server (DefuseFair.Pick) bit for bit. */
function pick(hex: string, n: number): number {
  return Number((BigInt(`0x${hex.slice(0, 13)}`) * BigInt(n)) >> 52n);
}

export async function detonatorFor(serverSeed: string, clientSeed: string, nonce: number): Promise<number> {
  return pick(await hmacHex(serverSeed, `${clientSeed}:${nonce}`), WIRE_COUNT);
}

export async function intelFor(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  candidates: number[],
): Promise<number> {
  return candidates[pick(await hmacHex(serverSeed, `${clientSeed}:${nonce}:intel`), candidates.length)];
}
