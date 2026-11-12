import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadedScorecards } from '../lib/course-scorecards';
test('Parkland mens stroke indexes match the November 2026 printed card', () => {
  assert.deepEqual(uploadedScorecards.r4.holes.map(h => h.rank),
    [18,4,16,8,12,2,6,10,14,17,15,1,9,7,5,11,13,3]);
});
