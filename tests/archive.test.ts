import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("2026 archive is an independent snapshot readable only by tournament members", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.members(user_id uuid);
      grant select on public.members to authenticated;
      create table public.tournaments(id integer, state jsonb, revision bigint);
      insert into members values('00000000-0000-0000-0000-000000000001');
      insert into tournaments values(1,'{"scores":{"example":4}}',564);`);
    await db.exec(readFileSync("supabase/archive-2026.sql","utf8"));
    await db.exec(`update tournaments set state='{"scores":{"example":9}}';`);
    const snapshot = await db.query<{state:{scores:{example:number}}}>("select state from tournament_archives");
    assert.equal(snapshot.rows[0].state.scores.example,4);
    await db.exec("set role anon");
    await assert.rejects(()=>db.query("select * from tournament_archives"),/permission denied/);
    await db.exec("reset role; set role authenticated");
    assert.equal((await db.query("select * from tournament_archives")).rows.length,0);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",["00000000-0000-0000-0000-000000000001"]);
    assert.equal((await db.query("select * from tournament_archives")).rows.length,1);
    await assert.rejects(()=>db.query("update tournament_archives set revision=0"),/permission denied/);
    await assert.rejects(()=>db.query("delete from tournament_archives"),/permission denied/);
  } finally { await db.close(); }
});
