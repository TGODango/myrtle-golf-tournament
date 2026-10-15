"use client";
import { useEffect, useState } from "react";
import { cloud } from "../../lib/cloud";

type Login = { player_id: string; phone: string };
type Golfer = { id: string; name: string };
type LoginActivity = { player_id: string; last_login_at: string };

export default function GolferLoginManagement({ golfers }: { golfers: Golfer[] }) {
  const [logins, setLogins] = useState<Login[]>([]);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  async function request(method: "GET" | "PATCH", body?: object) {
    if (!cloud) throw new Error("Cloud connection unavailable.");
    const { data, error } = await cloud.auth.getSession();
    if (error || !data.session) throw new Error("Sign in again to manage logins.");
    const res = await fetch("/api/admin/phone-logins", {
      method,
      headers: { Authorization: "Bearer " + data.session.access_token, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  }
  useEffect(() => {
    let active = true;
    request("GET").then(data => {
      if (!active) return;
      setLogins(data.logins);
      setActivity(data.activity || []);
      setEdits(Object.fromEntries(data.logins.map((x: Login) => [x.player_id, x.phone])));
    }).catch(e => { if (active) setMessage(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(playerId: string) {
    setSaving(playerId);
    setMessage("");
    try {
      const data = await request("PATCH", { playerId, phone: edits[playerId] || "" });
      setLogins(prev => prev.map(x => x.player_id === playerId ? { ...x, phone: data.phone } : x));
      setEdits(prev => ({ ...prev, [playerId]: data.phone }));
      setMessage("Phone number saved. The golfer can now sign in with the corrected number.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save phone number.");
    } finally { setSaving(""); }
  }
  return (
    <section className="panel">
      <h2>Golfer Login Management</h2>
      <p>View and correct the phone number used to sign in. Only administrators can access these numbers. Changes take effect immediately.</p>
      <p><strong>Tournament code:</strong> All golfers currently use the same four-digit tournament code. There is no separate PIN to view or reset for an individual golfer.</p>
      <p><strong>Successful sign-ins:</strong> A timestamp appears after each golfer successfully signs in by phone. Tracking starts with this update; earlier sign-ins are not available.</p>
      {loading ? <p>Loading golfer logins…</p> : golfers.map(g => {
        const login = logins.find(x => x.player_id === g.id);
        const changed = !!login && (edits[g.id] ?? "") !== login.phone;
        const lastLogin = activity.find(x => x.player_id === g.id)?.last_login_at;
        return <div className="form-row" key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ minWidth: 160 }}>{g.name}</label>
          {login ? <>
            <input type="tel" inputMode="tel" autoComplete="off" aria-label={g.name + " login phone"}
              value={edits[g.id] ?? login.phone} onChange={e => setEdits(prev => ({ ...prev, [g.id]: e.target.value }))}
              maxLength={18} style={{ width: 190 }} />
            <button type="button" disabled={!changed || !!saving} onClick={() => save(g.id)}>
              {saving === g.id ? "Saving…" : "Save phone"}
            </button>
          </> : <span>No linked phone login — account setup required</span>}
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            {lastLogin ? "Last signed in: " + new Date(lastLogin).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" }) + " ET" : "No recorded sign-in yet"}
          </span>
        </div>;
      })}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
