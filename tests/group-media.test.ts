import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("album restricts uploads to members and deletion to each uploader", async()=>{
 const db=new PGlite();
 const a="00000000-0000-0000-0000-000000000001",b="00000000-0000-0000-0000-000000000002",c="00000000-0000-0000-0000-000000000003";
 try {
 await db.exec(`create role authenticated; create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.members(user_id uuid);
 create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage,auth to authenticated;
 grant select on members to authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 insert into members values('${a}'),('${b}');`);
 await db.exec(readFileSync('supabase/group-media.sql','utf8'));
 await db.exec('set role authenticated');
 const user=async(id:string)=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const insert=async(name:string)=>db.query("insert into storage.objects values('myrtle-2026-media',$1)",[name]);
 await user(a);await insert(a+'--first.jpg');
 await assert.rejects(()=>insert(b+'--spoof.jpg'),/row-level security/);
 await assert.rejects(()=>insert(a+'--nested/path.jpg'),/row-level security/);
 await user(b);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await db.query('delete from storage.objects');assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await user(c);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await assert.rejects(()=>insert(c+'--outsider.jpg'),/row-level security/);
 await user(a);await db.query('delete from storage.objects');assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 }finally{await db.close();}
});
