// SPDX-FileCopyrightText: 2019-2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import * as assert from 'assert';
import { isBanned, normalizeIp, recordStrike } from './banlist';

// Tests share module state via the Maps inside banlist.ts. Each test below
// uses a distinct subnet so it can't be polluted by a previous test.

let failures = 0;
function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL  ${name}`);
    console.error(e);
  }
}

run('normalizeIp strips ::ffff: prefix', () => {
  assert.strictEqual(normalizeIp('::ffff:1.2.3.4'), '1.2.3.4');
  assert.strictEqual(normalizeIp('1.2.3.4'), '1.2.3.4');
  assert.strictEqual(normalizeIp('2001:db8::1'), '2001:db8::1');
  assert.strictEqual(normalizeIp(undefined), undefined);
});

run('isBanned is false for unseen IP', () => {
  assert.strictEqual(isBanned('10.10.0.1'), false);
});

run('19 strikes (one below threshold) do not ban', () => {
  for (let i = 0; i < 19; i++) recordStrike('10.10.1.1');
  assert.strictEqual(isBanned('10.10.1.1'), false);
});

run('20th strike triggers ban', () => {
  for (let i = 0; i < 20; i++) recordStrike('10.10.2.1');
  assert.strictEqual(isBanned('10.10.2.1'), true);
});

run('/24 grouping: 20 strikes spread across subnet still bans', () => {
  for (let i = 1; i <= 20; i++) recordStrike(`10.10.3.${i}`);
  // any IP in the /24 should now be banned
  assert.strictEqual(isBanned('10.10.3.1'), true);
  assert.strictEqual(isBanned('10.10.3.42'), true);
  assert.strictEqual(isBanned('10.10.3.255'), true);
});

run('/24 grouping: adjacent subnet is not banned', () => {
  for (let i = 0; i < 20; i++) recordStrike('10.10.4.1');
  assert.strictEqual(isBanned('10.10.4.1'), true);
  assert.strictEqual(isBanned('10.10.5.1'), false);
});

run('IPv4-mapped IPv6 (::ffff:) is grouped by /24 once normalized', () => {
  for (let i = 1; i <= 20; i++) recordStrike(normalizeIp(`::ffff:10.10.6.${i}`)!);
  assert.strictEqual(isBanned('10.10.6.99'), true);
});

run('IPv6 /64 grouping: strikes spread across /64 still ban', () => {
  for (let i = 1; i <= 20; i++) recordStrike(`2001:db8:0:1::${i.toString(16)}`);
  assert.strictEqual(isBanned('2001:db8:0:1::1'), true);
  assert.strictEqual(isBanned('2001:db8:0:1::ffff'), true);
  assert.strictEqual(isBanned('2001:db8:0:1:abcd:ef01:2345:6789'), true);
});

run('IPv6 /64 grouping: adjacent /64 is not banned', () => {
  for (let i = 0; i < 20; i++) recordStrike('2001:db8:0:2::1');
  assert.strictEqual(isBanned('2001:db8:0:2::1'), true);
  assert.strictEqual(isBanned('2001:db8:0:3::1'), false);
});

run('IPv6 /64 normalization: equivalent forms hit the same bucket', () => {
  // 2001:0db8:0000:0004::1 and 2001:db8:0:4::1 are the same /64 prefix.
  for (let i = 0; i < 19; i++) recordStrike('2001:0db8:0000:0004::1');
  recordStrike('2001:db8:0:4::abcd');
  assert.strictEqual(isBanned('2001:db8:0:4::1'), true);
});

run('IPv6 /64: full 8-hextet form (no ::) is bucketed', () => {
  for (let i = 0; i < 20; i++) {
    recordStrike(`2001:0db8:0000:0005:0000:0000:0000:000${i.toString(16)}`);
  }
  assert.strictEqual(isBanned('2001:db8:0:5::1'), true);
});

run('IPv6 /64: zone id is stripped before bucketing', () => {
  for (let i = 0; i < 19; i++) recordStrike('fe80::1%eth0');
  recordStrike('fe80::abcd%eth1');
  // both share fe80:0:0:0::/64 — different zone ids must not split the bucket
  assert.strictEqual(isBanned('fe80::beef'), true);
});

run('IPv6 /64: malformed input falls back to per-key (no ban leakage)', () => {
  // Unparseable inputs use the raw string as the key — they shouldn't accidentally
  // collide with valid IPv6 buckets, and they shouldn't crash.
  for (let i = 0; i < 19; i++) recordStrike(':::garbage');
  assert.strictEqual(isBanned(':::garbage'), false); // 19 strikes, no ban yet
  assert.strictEqual(isBanned('2001:db8:0:6::1'), false); // unrelated /64 unaffected
});

run('IPv6 /64: too few segments without :: returns to per-key fallback', () => {
  for (let i = 0; i < 20; i++) recordStrike('2001:db8:bad'); // only 3 segments, no ::
  // Treated as opaque key, so this exact string is now banned…
  assert.strictEqual(isBanned('2001:db8:bad'), true);
  // …but it doesn't leak into the real 2001:db8:0:0::/64 bucket.
  assert.strictEqual(isBanned('2001:db8::1'), false);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll banlist tests passed');
}
