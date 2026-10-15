import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });

async function adminClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceKey) return { error: reply({ error: "Login management is not configured." }, 503) };
  const token = /^Bearer (.+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return { error: reply({ error: "Sign in as an administrator." }, 401) };
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error } = await auth.auth.getUser(token);
  if (error || !user.user) return { error: reply({ error: "Session expired. Sign in again." }, 401) };
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member, error: memberError } = await db.from("members").select("role").eq("user_id", user.user.id).maybeSingle();
  if (memberError || member?.role !== "admin") return { error: reply({ error: "Administrator authorization required." }, 403) };
  return { db };
}

export async function GET(req: NextRequest) {
  const ctx = await adminClient(req);
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.db!.from("phone_logins").select("player_id,phone").order("player_id");
  if (error) return reply({ error: "Could not load golfer phone numbers." }, 500);
  const { data: activity, error: activityError } = await ctx.db!.from("golfer_login_activity")
    .select("player_id,last_login_at").order("last_login_at", { ascending: false });
  if (activityError) return reply({ error: "Could not load golfer login activity." }, 500);
  return reply({ logins: data || [], activity: activity || [], codeType: "shared" });
}

export async function PATCH(req: NextRequest) {
  const ctx = await adminClient(req);
  if (ctx.error) return ctx.error;
  let body: unknown;
  try { body = await req.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "Invalid request." }, 400);
  const { playerId, phone: rawPhone } = body as { playerId?: unknown; phone?: unknown };
  if (typeof playerId !== "string" || playerId.length > 128 || typeof rawPhone !== "string") return reply({ error: "Invalid golfer or phone." }, 400);
  const phone = rawPhone.replace(/\D/g, "");
  if (!/^\d{10}$/.test(phone)) return reply({ error: "Enter a valid 10-digit US phone number." }, 400);
  const { data: tournament, error: tournamentError } = await ctx.db!.from("tournaments").select("state").eq("id", 1).single();
  if (tournamentError || !Array.isArray(tournament?.state?.players) || !tournament.state.players.some((p: {id: string}) => p.id === playerId))
    return reply({ error: "Golfer not found in the tournament." }, 404);
  const { data: existing, error: lookupError } = await ctx.db!.from("phone_logins").select("user_id,phone").eq("player_id", playerId).maybeSingle();
  if (lookupError) return reply({ error: "Could not verify this golfer's login." }, 500);
  if (!existing) return reply({ error: "This golfer does not have a linked login yet. No account was changed." }, 409);
  const { data: conflict, error: conflictError } = await ctx.db!.from("phone_logins").select("player_id").eq("phone", phone).maybeSingle();
  if (conflictError) return reply({ error: "Could not check whether this phone is in use." }, 500);
  if (conflict && conflict.player_id !== playerId) return reply({ error: "That phone number belongs to another golfer." }, 409);
  if (existing.phone === phone) return reply({ phone });
  const { data: updated, error: updateError } = await ctx.db!.from("phone_logins")
    .update({ phone }).eq("player_id", playerId).eq("user_id", existing.user_id).select("phone").single();
  if (updateError || !updated) return reply({ error: updateError?.code === "23505" ? "That phone number is already in use." : "Could not save the phone number." }, 409);
  return reply({ phone: updated.phone });
}
