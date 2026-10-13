import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
type Entry = { phone: string; player_id: string };
const reply = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anon) return reply("Server configuration missing", 503);
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return reply("Administrator login required", 401);
  const db = createClient(url, service, { auth: { persistSession: false } });
  const { data: verified, error: authError } = await db.auth.getUser(bearer);
  if (authError || !verified.user) return reply("Invalid session", 401);
  const { data: member, error: memberError } = await db.from("members")
    .select("role").eq("user_id", verified.user.id).maybeSingle();
  if (memberError || member?.role !== "admin") return reply("Administrator required", 403);

  let entries: Entry[];
  try {
    const body = await req.json();
    if (!Array.isArray(body.entries)) return reply("Entries required");
    entries = body.entries;
  } catch { return reply("Invalid JSON"); }
  if (entries.length < 1 || entries.length > 12) return reply("Provide 1–12 golfers");
  const phones = new Set<string>(), players = new Set<string>();
  for (const item of entries) {
    if (!item || typeof item.phone !== "string" || typeof item.player_id !== "string") return reply("Invalid entry");
    item.phone = item.phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(item.phone) || !/^([a-f0-9-]{36}|p\d+)$/.test(item.player_id)) return reply("Invalid phone or player ID");
    if (phones.has(item.phone) || players.has(item.player_id)) return reply("Duplicate phone or player");
    phones.add(item.phone); players.add(item.player_id);
  }
  const { data: tournament, error: tourError } = await db.from("tournaments").select("state").eq("id", 1).single();
  if (tourError || !tournament) return reply("Tournament unavailable", 503);
  const valid = new Set((tournament.state?.players ?? []).map((p: {id: string}) => p.id));
  if (entries.some(e => !valid.has(e.player_id))) return reply("Unknown tournament player");

  const results: { player_id: string; status: string }[] = [];
  for (const entry of entries) {
    const { data: existing, error: existingError } = await db.from("phone_logins")
      .select("user_id,player_id").eq("phone", entry.phone).maybeSingle();
    if (existingError) return reply("Could not check existing phone mapping", 503);
    if (existing) {
      if (existing.player_id !== entry.player_id) return reply("Phone already assigned to a different golfer", 409);
      results.push({ player_id: entry.player_id, status: "already registered" });
      continue;
    }
    const { data: occupied } = await db.from("members").select("user_id")
      .eq("player_id", entry.player_id).maybeSingle();
    if (occupied) return reply("Player already has an account; review manually", 409);
    // Synthetic email is an internal Supabase Auth identifier, never sent to golfers.
    const email = `golfer-${entry.player_id}@players.dangogolf.com`;
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email, password: randomBytes(32).toString("hex"), email_confirm: true,
    });
    if (createError || !created.user) return reply("Could not create account for " + entry.player_id, 503);
    const id = created.user.id;
    const { error: memberInsert } = await db.from("members").insert({
      user_id: id, player_id: entry.player_id, role: "golfer",
    });
    if (memberInsert) {
      await db.auth.admin.deleteUser(id);
      return reply("Could not assign membership for " + entry.player_id, 503);
    }
    const { error: phoneInsert } = await db.from("phone_logins").insert({
      phone: entry.phone, user_id: id, player_id: entry.player_id,
    });
    if (phoneInsert) {
      await db.from("members").delete().eq("user_id", id);
      await db.auth.admin.deleteUser(id);
      return reply("Could not register phone for " + entry.player_id, 503);
    }
    results.push({ player_id: entry.player_id, status: "created" });
  }
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
