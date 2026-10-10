import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { demo } from "../lib/demo";
test("database score authorization, concurrent versions, idempotency and audit", async () => {
  const db = new PGlite();
  await db.exec(
    `create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  const sql = readFileSync(
    "supabase/migrations/001_tournament.sql",
    "utf8",
  ).replace(
    "alter publication supabase_realtime add table public.tournaments;",
    "",
  );
  await db.exec(sql);
  const s = demo();
  s.scores = {};
  s.rounds.forEach((r) => (r.verified = true));
  const ids = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
  ];
  for (let i = 0; i < 3; i++) {
    await db.query("insert into auth.users values($1)", [ids[i]]);
    await db.query("insert into members values($1,$2,$3)", [
      ids[i],
      `p${i}`,
      i === 2 ? "admin" : "golfer",
    ]);
  }
  await db.query("insert into tournaments(id,state) values(1,$1)", [s]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[0],
  ]);
  const submit = (player: string, expected: number, req: string, gross = 4) =>
    db.query("select submit_score($1,$2,0,$3,$4,$5)", [
      "m0-0",
      player,
      gross,
      expected,
      req,
    ]);
  const req = "10000000-0000-0000-0000-000000000001";
  await submit("p0", 0, req);
  await submit("p0", 0, req);
  await assert.rejects(
    () => submit("p0", 0, "10000000-0000-0000-0000-000000000002"),
    /Conflict/,
  );
  await assert.rejects(() => submit("p0", 0, req, 5), /identifier conflict/);
  await assert.rejects(
    () => submit("p1", 0, "10000000-0000-0000-0000-000000000003"),
    /Not authorized/,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[1],
  ]);
  await submit("p1", 0, "10000000-0000-0000-0000-000000000004", 5);
  const row = await db.query<{ state: typeof s; revision: number }>(
    "select state,revision from tournaments",
  );
  assert.equal(row.rows[0].state.scores["m0-0:p0:0"].gross, 4);
  assert.equal(row.rows[0].state.scores["m0-0:p1:0"].gross, 5);
  assert.equal(Number(row.rows[0].revision), 2);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[2],
  ]);
  const races = await Promise.allSettled([
    submit("p0", 1, "10000000-0000-0000-0000-000000000005", 6),
    submit("p0", 1, "10000000-0000-0000-0000-000000000006", 7),
  ]);
  assert.equal(races.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(races.filter((x) => x.status === "rejected").length, 1);
  const audit = await db.query<{ n: number }>(
    "select count(*)::int n from audit",
  );
  assert.equal(audit.rows[0].n, 3);
  await assert.rejects(
    () => db.query("select update_tournament($1,0)", [s]),
    /Conflict/,
  );

  const current = (
    await db.query<{ state: typeof s; revision: number }>(
      "select state,revision from tournaments",
    )
  ).rows[0];
  const unlocked = structuredClone(current.state);
  unlocked.rounds[1].locked = false;
  unlocked.matches = unlocked.matches.filter((m) => m.round !== "r1");
  await db.query("select update_tournament($1,$2)", [
    unlocked,
    current.revision,
  ]);
  const bad = structuredClone(unlocked);
  bad.matches.find((m) => m.round === "r4")!.slot = 2;
  await assert.rejects(
    () =>
      db.query("select update_tournament($1,$2)", [
        bad,
        Number(current.revision) + 1,
      ]),
    /Foursome capacity/,
  );
  await db.query("update members set role='captain' where player_id='p0'");
  const opposing = "00000000-0000-0000-0000-000000000006";
  await db.query("insert into auth.users values($1)", [opposing]);
  await db.query("insert into members values($1,'p6','captain')", [opposing]);
  const draft = {
    id: "draft-r1-0",
    round: "r1",
    a: ["p0", "p1"],
    b: [] as string[],
    slot: 0,
    approved: false,
    nomination: 0,
  };
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[0],
  ]);
  await db.query("select save_draft($1)", [draft]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    opposing,
  ]);
  draft.b = ["p6", "p7"];
  await db.query("select save_draft($1)", [draft]);
  await assert.rejects(
    () => db.query("select save_draft($1)", [{ ...draft, a: ["p2", "p3"] }]),
    /opposing captain/,
  );
  await assert.rejects(
    () =>
      db.query("select submit_score($1,$2,0,4,0,$3)", [
        draft.id,
        "p6",
        "10000000-0000-0000-0000-000000000007",
      ]),
    /locked approved pairings/,
  );
  const drafted = (
    await db.query<{ state: typeof s }>("select state from tournaments")
  ).rows[0].state.matches.find((m) => m.id === draft.id)!;
  assert.equal(drafted.approved, false);
  assert.equal(drafted.manual, undefined);
  await db.exec("set role authenticated");
  await assert.rejects(() => db.exec("update tournaments set revision=99"));
  await db.close();
});
