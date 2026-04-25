// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

// Per-worker threshold. Connect runs as a cluster (one worker per CPU) so the
// effective per-/24 limit is THRESHOLD * workerCount in the worst case where
// requests round-robin across workers.
const THRESHOLD = 20;
const WINDOW_MS = 10 * 60 * 1000;
const BAN_DURATION_MS = 60 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

const strikes = new Map<string, number[]>();
const bans = new Map<string, number>();

export function normalizeIp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^::ffff:/, '');
}

// Key bans/strikes by /24 for IPv4 so botnets cycling within a subnet
// (e.g. 93.123.109.163, .180, .214) all contribute to the same counter.
// IPv6 falls back to per-address since /24 doesn't apply.
function toKey(ip: string): string {
  const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip);
  return m ? `${m[1]}.0/24` : ip;
}

export function isBanned(ip: string): boolean {
  const key = toKey(ip);
  const unbanAt = bans.get(key);
  if (unbanAt === undefined) return false;
  if (Date.now() >= unbanAt) {
    bans.delete(key);
    return false;
  }
  return true;
}

export function recordStrike(ip: string): void {
  const key = toKey(ip);
  const now = Date.now();
  const history = (strikes.get(key) || []).filter(t => now - t < WINDOW_MS);
  history.push(now);

  if (history.length >= THRESHOLD) {
    const unbanAt = now + BAN_DURATION_MS;
    bans.set(key, unbanAt);
    strikes.delete(key);
    console.log(`[banlist] Banned ${key} until ${new Date(unbanAt).toISOString()} (${history.length} strikes in ${Math.round(WINDOW_MS / 60000)}m)`);
    return;
  }

  strikes.set(key, history);

  if (strikes.size > MAX_TRACKED_KEYS) {
    for (const [k, ts] of strikes) {
      if (ts.length === 0 || now - ts[ts.length - 1] >= WINDOW_MS) {
        strikes.delete(k);
      }
    }
  }
}
