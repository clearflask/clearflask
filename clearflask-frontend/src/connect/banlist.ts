// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

// Per-worker threshold. Connect runs as a cluster (one worker per CPU) so the
// effective per-IP limit is THRESHOLD * workerCount in the worst case where
// requests round-robin across workers.
const THRESHOLD = 10;
const WINDOW_MS = 10 * 60 * 1000;
const BAN_DURATION_MS = 60 * 60 * 1000;
const MAX_TRACKED_IPS = 10000;

const strikes = new Map<string, number[]>();
const bans = new Map<string, number>();

export function normalizeIp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^::ffff:/, '');
}

export function isBanned(ip: string): boolean {
  const unbanAt = bans.get(ip);
  if (unbanAt === undefined) return false;
  if (Date.now() >= unbanAt) {
    bans.delete(ip);
    return false;
  }
  return true;
}

export function recordStrike(ip: string): void {
  const now = Date.now();
  const history = (strikes.get(ip) || []).filter(t => now - t < WINDOW_MS);
  history.push(now);

  if (history.length >= THRESHOLD) {
    const unbanAt = now + BAN_DURATION_MS;
    bans.set(ip, unbanAt);
    strikes.delete(ip);
    console.log(`[banlist] Banned ${ip} until ${new Date(unbanAt).toISOString()} (${history.length} strikes in ${Math.round(WINDOW_MS / 60000)}m)`);
    return;
  }

  strikes.set(ip, history);

  if (strikes.size > MAX_TRACKED_IPS) {
    for (const [key, ts] of strikes) {
      if (ts.length === 0 || now - ts[ts.length - 1] >= WINDOW_MS) {
        strikes.delete(key);
      }
    }
  }
}
