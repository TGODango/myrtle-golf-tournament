import { test } from "node:test";
import { strict as assert } from "node:assert";
import { uploadedScorecards } from "../lib/course-scorecards";
test("all five uploaded scorecards have valid tees and 18 distinct stroke indices",()=>{
  const tees=["White","White","Blue","Blue","White"];
  const yards=[5576,6310,6564,6519,6396];
  const pars=[70,71,71,72,72];
  for(let i=0;i<5;i++) {
    const c=uploadedScorecards["r"+i];
    assert.equal(c.tee,tees[i]);
    assert.equal(c.holes.length,18);
    assert.equal(c.holes.reduce((n,h)=>n+h.yards,0),yards[i]);
    assert.equal(c.holes.reduce((n,h)=>n+h.par,0),pars[i]);
    assert.deepEqual(c.holes.map(h=>h.rank).sort((a,b)=>a-b),Array.from({length:18},(_,j)=>j+1));
    assert.ok(c.rating>60&&c.slope>=55&&c.slope<=155);
  }
});
