import { test } from "node:test";
import { strict as assert } from "node:assert";
import { demo } from "../lib/demo";
import { key, result, standings } from "../lib/scoring";
import { moneyLeaderboard, roundSkins } from "../lib/money";

/** Deterministic, in-memory tournament. Never connects to Supabase or writes live scores. */
test("five-round tournament: 18 matches, 90 holes of skins, $2,400 accounted for", () => {
  const s = demo();
  s.scores = {};
  for (const p of s.players) {
    p.index = 0;
    for (const r of s.rounds) p.overrides[r.id] = 0;
  }
  for (const r of s.rounds) r.verified = true;
  assert.deepEqual(s.rounds.map(r => r.format),
    ["bestball", "stableford", "shamble", "scramble", "singles"]);
  assert.equal(s.matches.length, 18);

  for (const m of s.matches) {
    const r = s.rounds.find(r => r.id === m.round)!;
    for (let hole = 0; hole < 18; hole++) {
      for (const [side, ids] of [[0, m.a], [1, m.b]] as const) {
        const participants = r.format === "scramble" ? ids.slice(0, 1) : ids;
        for (const id of participants) {
          const gross = m.id === s.matches.find(x => x.round === r.id)!.id &&
            side === 0 && id === m.a[0] && hole === 0
            ? 1 : r.holes[hole].par + (side === 0 ? -1 : 2);
          s.scores[key(m.id, id, hole)] = { gross, version: 1 };
        }
      }
    }
  }

  for (const m of s.matches) {
    const x = result(s, m);
    assert.equal(x.complete, true, m.id + " incomplete");
    assert.deepEqual(x.points, [1, 0], m.id + " winner");
  }
  const board = standings(s);
  assert.deepEqual(board.official, [18, 0]);
  assert.equal(board.complete, 18);
  assert.equal(board.remaining, 0);

  let totalSkins = 0;
  for (const r of s.rounds) {
    const x = roundSkins(s, r);
    assert.equal(x.complete, true, r.name + " skins incomplete");
    assert.equal(x.pot, 240);
    assert.equal(x.skins.length, 1, r.name + " expected one unique skin");
    assert.equal(x.skins[0].hole, 1);
    assert.equal(x.skins[0].amount, 240);
    assert.equal(x.unawarded, 0);
    assert.equal(x.mode, r.format === "shamble" || r.format === "scramble" ? "team" : "individual");
    totalSkins += x.skins.reduce((sum, skin) => sum + skin.amount, 0);
  }
  assert.equal(totalSkins, 1200);
  const money = moneyLeaderboard(s);
  const sums = money.reduce((a, p) => ({
    matches: a.matches + p.matches,
    skins: a.skins + p.skins,
    championship: a.championship + p.championship,
    total: a.total + p.total,
  }), { matches: 0, skins: 0, championship: 0, total: 0 });
  assert.deepEqual(sums, { matches: 600, skins: 1200, championship: 600, total: 2400 });

  // One missing score invalidates skins, even if a match was already decided.
  const last = s.matches.find(m => m.round === "r4")!;
  delete s.scores[key(last.id, last.a[0], 17)];
  assert.equal(roundSkins(s, s.rounds[4]).complete, false);
});

test("scramble match-play uses the difference between pair handicaps", () => {
  const s = demo();
  const r = s.rounds[3], m = s.matches.find(x => x.round === r.id)!;
  for (const p of s.players) p.overrides[r.id] = 0;
  for (const id of m.b) s.players.find(p => p.id === id)!.overrides[r.id] = 20;
  // Pair A = 0, Pair B = 10. Both gross 4 on all holes.
  for (let hole = 0; hole < 18; hole++) {
    s.scores[key(m.id, m.a[0], hole)] = { gross: 4, version: 1 };
    s.scores[key(m.id, m.b[0], hole)] = { gross: 4, version: 1 };
  }
  const x = result(s, m);
  assert.equal(x.complete, true);
  assert.deepEqual(x.points, [0, 1]);
  assert.equal(x.totals[0] - x.totals[1], 10);
});

test("tournament tied 9-9 has no automatic championship payout", () => {
  const s = demo();
  for (const [i, m] of s.matches.entries()) m.manual = i < 9 ? 1 : 0;
  assert.equal(standings(s).winner, "Tournament tied 9–9");
  assert.equal(moneyLeaderboard(s).reduce((a, x) => a + x.championship, 0), 0);
});
