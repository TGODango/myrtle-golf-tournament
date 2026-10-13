import { test } from "node:test";
import assert from "node:assert/strict";
import {
  courseHandicap,
  strokes,
  stableford,
  result,
  standings,
  key,
} from "../lib/scoring";
import { demo } from "../lib/demo";
test("WHS rounds final handicap, including plus handicaps", () => {
  assert.equal(courseHandicap(10, 130, 73, 72), 13);
  assert.equal(courseHandicap(-2, 113, 72, 72), -2);
  assert.equal(courseHandicap(2.5, 113, 72, 72), 3);
});
test("stroke allocation handles 0, >18, >36 and plus handicaps", () => {
  assert.equal(strokes(0, 1), 0);
  assert.equal(strokes(20, 2), 2);
  assert.equal(strokes(20, 3), 1);
  assert.equal(strokes(37, 1), 3);
  assert.equal(strokes(-2, 18), -1);
  assert.equal(strokes(-2, 1), 0);
});
test("Standard Stableford caps at five and clamps at zero", () => {
  assert.deepEqual(
    [8, 6, 5, 4, 3, 2, 1].map((g) => stableford(g, 4, 0)),
    [0, 0, 1, 2, 3, 4, 5],
  );
  assert.equal(stableford(1, 5, 1), 5);
});
function fixture(
  format: "bestball" | "shamble" | "singles" | "stableford",
  a: number,
  b: number,
  holes = 18,
) {
  const s = demo();
  s.scores = {};
  s.matches = [s.matches[0]];
  const m = s.matches[0];
  s.rounds[0].format = format;
  s.players.forEach((p) => (p.index = 0));
  if (format === "singles") {
    m.a = m.a.slice(0, 1);
    m.b = m.b.slice(0, 1);
  }
  for (let h = 0; h < holes; h++)
    for (const id of [...m.a, ...m.b])
      s.scores[key(m.id, id, h)] = {
        gross: m.a.includes(id) ? a : b,
        version: 1,
      };
  return { s, m };
}
test("best ball and shamble end mathematically at 10 & 8", () => {
  for (const f of ["bestball", "shamble"] as const) {
    const { s, m } = fixture(f, 4, 5);
    const x = result(s, m);
    assert.equal(x.status, "10 & 8");
    assert.deepEqual(x.points, [1, 0]);
    assert.equal(x.played, 10);
  }
});
test("singles and best ball tied after 18 halve", () => {
  for (const f of ["singles", "bestball"] as const) {
    const { s, m } = fixture(f, 4, 4);
    assert.equal(result(s, m).status, "Halved");
    assert.deepEqual(result(s, m).points, [0.5, 0.5]);
  }
});
test("Stableford combines both players, does not finish early", () => {
  const { s, m } = fixture("stableford", 4, 5, 10);
  assert.equal(result(s, m).complete, false);
  assert.deepEqual(result(s, m).points, [0, 0]);
  assert.equal(result(s, m).totals[0], 40);
  assert.equal(result(s, m).individual[m.a[0]], 20);
});
test("relative handicap applies across all four, full CH for Stableford", () => {
  const { s, m } = fixture("bestball", 4, 4, 1);
  s.players.find((p) => p.id === m.b[0])!.index = 18;
  assert.equal(result(s, m).lead, -1);
  s.rounds[0].format = "stableford";
  assert.equal(result(s, m).individual[m.b[0]], 3);
});
test("best ball uses lowest partner, shamble configurable combined", () => {
  const { s, m } = fixture("bestball", 4, 5, 1);
  s.scores[key(m.id, m.a[1], 0)].gross = 9;
  assert.equal(result(s, m).lead, 1);
  s.rounds[0].format = "shamble";
  s.rounds[0].shamble = "combined";
  assert.equal(result(s, m).lead, -1);
});
test("18 halved matches finish 9–9; projections are not official", () => {
  const s = demo();
  s.scores = {};
  s.matches.forEach((m) => (m.manual = 0.5));
  assert.deepEqual(standings(s).official, [9, 9]);
  assert.equal(standings(s).winner, "Tournament tied 9–9");
  s.matches.forEach((m) => {
    m.manual = undefined;
  });
  assert.deepEqual(standings(s).official, [0, 0]);
});
test("reopened match removes earned points", () => {
  const { s, m } = fixture("singles", 4, 5);
  m.reopened = true;
  assert.deepEqual(result(s, m).points, [0, 0]);
});
