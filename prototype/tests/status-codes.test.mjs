// Status code reference data. Run with: node --test "prototype/tests/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, CODES, findCode } from '../site/status-codes.js';

test('status codes are unique, sorted and in a known class', () => {
  const nums = CODES.map((c) => c.code);
  assert.deepEqual(nums, [...new Set(nums)].sort((a, b) => a - b));
  for (const c of CODES) assert.ok(CLASSES[c.cls] && c.name && c.summary, `${c.code} is complete`);
});

test('findCode accepts numbers and query-string text', () => {
  assert.equal(findCode('404').name, 'Not Found');
  assert.equal(findCode(500).name, 'Internal Server Error');
  assert.equal(findCode('999'), undefined);
});
