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

run('IPv6 falls back to per-address (no /24 grouping)', () => {
  for (let i = 0; i < 20; i++) recordStrike('2001:db8:0:1::1');
  assert.strictEqual(isBanned('2001:db8:0:1::1'), true);
  // a different IPv6 in the same logical block is not banned
  assert.strictEqual(isBanned('2001:db8:0:1::2'), false);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll banlist tests passed');
}
