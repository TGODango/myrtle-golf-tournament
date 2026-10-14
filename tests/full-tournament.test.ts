import { test } from "node:test";
import assert from "node:assert/strict";
import { demo } from "../lib/demo";
import { uploadedScorecards } from "../lib/course-scorecards";
import { key, result, standings, courseHandicap, strokes } from "../lib/scoring";
import { liveSkins, moneyLeaderboard, roundSkins } from "../lib/money";

/**
 * Full simulated tournament using only in-memory data. No Supabase calls.
 * All 12 golfers, all 5 rounds, 18 matches, 18 holes, all five formats.
 */
function fullTournament() {
  const s = demo();
  s.scores = {};
  s.players.forEach(p => { p.index = 0; p.overrides = {}; });
  for (const r of s.rounds) {
    const actual = uploadedScorecards[r.id];
    assert.ok(actual, `missing course card ${r.id}`);
    r.holes = structuredClone(actual.holes);
    r.rating = actual.rating;
    r.slope = actual.slope;
    r.tee = actual.tee;
    r.verified = true; // Test fixture only, never persisted.
    r.locked = true;
  }
  for (const m of s.matches) {
    const r = s.rounds.find(x => x.id === m.round)!;
    const ids = r.format === "scramble" ? [m.a[0], m.b[0]] : [...m.a, ...m.b];
    for (let h = 0; h < 18; h++)
      for (const id of ids) {
        // Deliberate America/Europe ties for each hole, to test 9-9 aggregate.
        s.scores[key(m.id, id, h)] = { gross: r.holes[h].par, version: 1 };
      }
  }
  return s;
}

test("all five scorecards have 18 holes, unique handicap ranks and valid pars", () => {
  assert.equal(Object.keys(uploadedScorecards).length, 5);
  for (const [id, r] of Object.entries(uploadedScorecards)) {
    assert.equal(r.holes.length, 18, `${id} hole count`);
    assert.deepEqual(r.holes.map(h=>h.rank).sort((a,b)=>a-b), Array.from({length:18},(_,i)=>i+1), `${id} stroke indices`);
    assert.ok(r.holes.every(h=>h.par>=3 && h.par<=5 && h.yards>0), `${id} valid holes`);
    assert.ok(r.rating>60 && r.rating<80 && r.slope>=55 && r.slope<=155, `${id} tee rating`);
  }
});

test("complete five-round simulation: 12 golfers, 18 matches, all 18 holes, 9-9 tie", () => {
  const s = fullTournament();
  assert.equal(s.players.length,12);
  assert.equal(s.rounds.length,5);
  assert.equal(s.matches.length,18);
  assert.deepEqual(s.rounds.map(r=>s.matches.filter(m=>m.round===r.id).length),[3,3,3,3,6]);
  assert.deepEqual(s.rounds.map(r=>r.format),["bestball","stableford","shamble","scramble","singles"]);
  assert.equal(Object.keys(s.scores).length, 18 * (18 * 4) - (3 * 18 * 2) - (6 * 18 * 2));
  for(const m of s.matches) {
    const x=result(s,m);
    assert.equal(x.complete,true,`${m.id} must finish`);
    assert.equal(x.played,18,`${m.id} all holes played`);
    assert.deepEqual(x.points,[0.5,0.5],`${m.id} halved`);
  }
  const board=standings(s);
  assert.equal(board.complete,18);
  assert.deepEqual(board.official,[9,9]);
  assert.equal(board.remaining,0);
  assert.equal(board.winner,"Tournament tied 9–9");
  for(const r of s.rounds) {
    const skins=roundSkins(s,r);
    assert.equal(skins.complete,true,`${r.id} skins can be settled`);
    assert.equal(skins.mode,["shamble","scramble"].includes(r.format)?"team":"individual");
    assert.equal(skins.skins.length,0,`${r.id} all holes tied, no skins`);
    assert.equal(skins.unawarded,240,`${r.id} unawarded pot`);
  }
  const earnings=moneyLeaderboard(s);
  assert.equal(earnings.length,12);
  assert.ok(earnings.every(e=>e.championship===0 && e.skins===0 && e.paid===0));
  assert.ok(earnings.every(e=>e.matches===50), "each golfer receives $50 for five halved match appearances");
});

test("one missing golfer score blocks individual skins and remains provisional",()=>{
  const s=fullTournament(),r=s.rounds[0],m=s.matches[0];
  delete s.scores[key(m.id,m.a[0],17)];
  assert.equal(roundSkins(s,r).complete,false);
  assert.equal(roundSkins(s,r).skins.length,0);
  assert.equal(liveSkins(s,r)[17].status,"provisional");
  assert.equal(liveSkins(s,r)[17].entered,11);
});

test("scramble needs only one team score per pair per hole, and pays team skins to both partners",()=>{
  const s=fullTournament(),r=s.rounds[3],m=s.matches.find(x=>x.round===r.id)!;
  assert.equal(roundSkins(s,r).complete,true);
  s.scores[key(m.id,m.a[0],0)].gross=r.holes[0].par-2;
  const skins=roundSkins(s,r);
  assert.equal(skins.skins.length,1);
  assert.deepEqual(skins.skins[0].winners,m.a);
  assert.equal(skins.skins[0].amount,240);
  for(const id of m.a) assert.equal(moneyLeaderboard(s).find(e=>e.player===id)?.skins,120);
  assert.equal(liveSkins(s,r)[0].status,"won");
});

test("individual skin on a single hole awards the whole pot to one player, not an entire pair",()=>{
  const s=fullTournament(),r=s.rounds[0],m=s.matches[0],id=m.a[0];
  s.scores[key(m.id,id,0)].gross=r.holes[0].par-2;
  const skins=roundSkins(s,r);
  assert.equal(skins.skins.length,1);
  assert.deepEqual(skins.skins[0].winners,[id]);
  assert.equal(moneyLeaderboard(s).find(e=>e.player===id)?.skins,240);
});

test("championship winnings are paid only after all 18 matches are decided",()=>{
  const s=fullTournament();
  s.matches.slice(0,10).forEach(m=>m.manual=1);
  assert.deepEqual(standings(s).official,[14,4]);
  assert.equal(standings(s).winner,"Palmetto");
  const earnings=moneyLeaderboard(s);
  assert.equal(earnings.filter(e=>e.championship===100).length,6);
  assert.equal(earnings.filter(e=>e.championship===0).length,6);
  s.matches[17].reopened=true;
  assert.equal(standings(s).complete,17);
  assert.ok(moneyLeaderboard(s).every(e=>e.championship===0),"no early championship payout");
});

test("scramble 35/15 weighted team handicap and relative stroke allocation",()=>{
  const s=fullTournament(),r=s.rounds[3],m=s.matches.find(x=>x.round===r.id)!;
  const players=[...m.a,...m.b].map(id=>s.players.find(p=>p.id===id)!);
  players.forEach((p,i)=>p.overrides[r.id]=[4,12,8,16][i]);
  const america=Math.round(.35*4+.15*12);
  const europe=Math.round(.35*8+.15*16);
  assert.equal(america,3);
  assert.equal(europe,5);
  assert.equal(strokes(europe-america,1),1);
  // At handicap-ranked hole 1, Europe's gross +1 still nets a tie.
  const idx=r.holes.findIndex(h=>h.rank===1);
  s.scores[key(m.id,m.b[0],idx)].gross++;
  assert.equal(result(s,m).complete,true);
  assert.equal(result(s,m).lead,0);
});
