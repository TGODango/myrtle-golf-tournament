import { writeFileSync } from "node:fs";
import { blank } from "../lib/demo";
const state = JSON.stringify(blank()).replaceAll("'", "''");
writeFileSync(
  "supabase/seed.sql",
  `-- Blank live tournament. Run once after migrations. Never contains demo scores.\ninsert into public.tournaments(id,state) values (1,'${state}'::jsonb) on conflict(id) do nothing;\n`,
);
