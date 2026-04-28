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
// For IPv6, bucket by /64 — the standard residential allocation — so a single
// subscriber can't burn through 2^64 addresses to evade the per-address limit.
function toKey(ip: string): string {
  const v4 = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip);
  if (v4) return `${v4[1]}.0/24`;
  const prefix = ipv6Prefix64(ip);
  if (prefix) return `${prefix}::/64`;
  return ip;
}

// Returns the first 4 hextets of an IPv6 address (the /64 prefix), normalized to
// lowercase with leading zeros stripped. Returns undefined if the input is not an
// IPv6 address we can parse.
function ipv6Prefix64(raw: string): string | undefined {
  if (!raw || raw.indexOf(':') === -1) return undefined;
  // Strip a zone id (e.g. fe80::1%eth0) before parsing.
  const ip = raw.split('%')[0].toLowerCase();
  // Reject embedded IPv4 (e.g. ::ffff:1.2.3.4) — normalizeIp already strips the
  // common ::ffff: prefix; anything else with a dot we treat as unknown.
  if (ip.indexOf('.') !== -1) return undefined;

  const doubleColonIdx = ip.indexOf('::');
  let parts: string[];
  if (doubleColonIdx === -1) {
    parts = ip.split(':');
    if (parts.length !== 8) return undefined;
  } else {
    const head = ip.slice(0, doubleColonIdx);
    const tail = ip.slice(doubleColonIdx + 2);
    const headParts = head.length ? head.split(':') : [];
    const tailParts = tail.length ? tail.split(':') : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return undefined;
    parts = [...headParts, ...new Array(missing).fill('0'), ...tailParts];
  }

  const prefix = parts.slice(0, 4);
  for (const hextet of prefix) {
    if (!/^[0-9a-f]{1,4}$/.test(hextet)) return undefined;
  }
  return prefix.map(h => h.replace(/^0+(?=.)/, '')).join(':');
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
