import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
const fail = (status = 401) =>
  NextResponse.json({ error: status === 429 ? "Too many attempts. Try again in 15 minutes." : "Phone number or tournament code not recognized." }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const passcode = process.env.TOURNAMENT_PASSCODE;
  if (!url || !serviceKey || !passcode || !/^\d{4}$/.test(passcode))
    return NextResponse.json({ error: "Phone login is not configured yet." }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return fail(); }
  if (!body || typeof body !== "object") return fail();
  const { phone: input, code } = body as { phone?: unknown; code?: unknown };
  if (typeof input !== "string" || typeof code !== "string") return fail();
  const phone = input.replace(/\D/g, "");
  if (!/^\d{10}$/.test(phone) || !/^\d{4}$/.test(code)) return fail();

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Each phone and IP has a persistent shared rate limit across Vercel instances.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipBucket = "ip:" + createHash("sha256").update(ip).digest("hex");
  const phoneBucket = "phone:" + createHash("sha256").update(phone).digest("hex");
  const [ipLimit, phoneLimit] = await Promise.all([
    db.rpc("check_phone_login_limit", { p_bucket: ipBucket }),
    db.rpc("check_phone_login_limit", { p_bucket: phoneBucket }),
  ]);
  if (ipLimit.error || phoneLimit.error) return NextResponse.json({ error: "Login temporarily unavailable." }, { status: 503 });
  if (!ipLimit.data || !phoneLimit.data) return fail(429);

  const supplied = createHash("sha256").update(code).digest();
  const expected = createHash("sha256").update(passcode).digest();
  const matches = timingSafeEqual(supplied, expected);
  if (!matches) return fail();

  const { data: record, error: lookupError } = await db
    .from("phone_logins").select("user_id,player_id").eq("phone", phone).maybeSingle();
  if (lookupError || !record) return fail();

  const { data: authUser, error: userError } = await db.auth.admin.getUserById(record.user_id);
  if (userError || !authUser.user?.email) return fail();

  // Issue a Supabase Auth session without sending email. Never return a service-role key.
  const { data: link, error: linkError } = await db.auth.admin.generateLink({
    type: "magiclink", email: authUser.user.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return NextResponse.json({ error: "Could not start session." }, { status: 503 });
  const auth = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await auth.auth.verifyOtp({
    token_hash: tokenHash, type: "magiclink",
  });
  if (verifyError || !verified.session || verified.user?.id !== record.user_id)
    return NextResponse.json({ error: "Could not start session." }, { status: 503 });
  // Record successful phone sign-ins only. Never store tournament codes or tokens.
  // Login must still succeed if activity logging is temporarily unavailable.
  try {
    await db.from("golfer_login_activity").upsert({
      player_id: record.player_id, phone, last_login_at: new Date().toISOString(),
    }, { onConflict: "player_id" });
  } catch { /* Noncritical audit logging */ }
  return NextResponse.json({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  }, { headers: { "Cache-Control": "no-store" } });
}
