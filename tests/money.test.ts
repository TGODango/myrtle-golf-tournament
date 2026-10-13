import { test } from "node:test";
import { strict as assert } from "node:assert";
import { demo } from "../lib/demo";
import { key, result, stableford } from "../lib/scoring";
import { moneyLeaderboard, roundSkins } from "../lib/money";

test("standard Stableford awards zero through five points", () => {
  assert.equal(stableford(6,4,0),0);
  assert.equal(stableford(5,4,0),1);
  assert.equal(stableford(4,4,0),2);
  assert.equal(stableford(3,4,0),3);
  assert.equal(stableford(2,4,0),4);
  assert.equal(stableford(1,4,0),5);
});

test("individual skins require all twelve complete cards and exclude tied holes", () => {
  const s=demo(),r=s.rounds[0];r.verified=true;
  for(const m of s.matches.filter(m=>m.round===r.id))
    for(const id of [...m.a,...m.b])
      for(let h=0;h<18;h++)
        s.scores[key(m.id,id,h)]={gross:r.holes[h].par+1,version:1};
  const skins=roundSkins(s,r);
  assert.equal(skins.complete,true);
  assert.equal(skins.skins.length,0);
  assert.equal(skins.unawarded,240);
  delete s.scores[key("m0-0","p0",17)];
  assert.equal(roundSkins(s,r).complete,false);
});

test("winning pair is paid twenty dollars per golfer", () => {
  const s=demo();
  const m=s.matches[0];m.manual=1;
  const earnings=moneyLeaderboard(s);
  for(const id of m.a) assert.equal(earnings.find(x=>x.player===id)?.matches,20);
  for(const id of m.b) assert.equal(earnings.find(x=>x.player===id)?.matches,0);
});

test("halved pair match splits twenty dollars to four players as ten each", () => {
  const s=demo();const m=s.matches[0];m.manual=0.5;
  const earnings=moneyLeaderboard(s);
  for(const id of [...m.a,...m.b]) assert.equal(earnings.find(x=>x.player===id)?.matches,10);
});

test("scramble uses one gross team score per hole", () => {
  const s=demo(),r=s.rounds[3],m=s.matches.find(m=>m.round===r.id)!;
  assert.equal(r.format,"scramble");
  for(let h=0;h<18;h++) {
    s.scores[key(m.id,m.a[0],h)]={gross:r.holes[h].par,version:1};
    s.scores[key(m.id,m.b[0],h)]={gross:r.holes[h].par+2,version:1};
  }
  assert.equal(result(s,m).complete,true);
});
