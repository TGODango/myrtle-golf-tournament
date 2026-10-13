"use client";
import { useEffect, useState } from "react";
import { cloud } from "../../lib/cloud";

type Golfer = { id: string; name: string };
export default function Setup() {
  const [players, setPlayers] = useState<Golfer[]>([]);
  const [phones, setPhones] = useState<Record<string,string>>({});
  const [message, setMessage] = useState("Loading your tournament…");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      if (!cloud) { setMessage("Supabase is not configured"); return; }
      const { data: auth } = await cloud.auth.getUser();
      if (!auth.user) { setMessage("Sign in to DangoGolf first, then reopen this page."); return; }
      const { data: member } = await cloud.from("members").select("role").eq("user_id", auth.user.id).maybeSingle();
      if (member?.role !== "admin") { setMessage("Administrator access required"); return; }
      const { data, error } = await cloud.rpc("read_tournament");
      if (error) { setMessage(error.message); return; }
      setPlayers(data.state.players);
      setMessage("Enter each golfer's phone number, then create their accounts.");
    })();
  }, []);
  async function submit() {
    if (!cloud) return;
    const entries = players.filter(p => phones[p.id]?.trim()).map(p => ({
      player_id: p.id, phone: phones[p.id].replace(/\D/g,""),
    }));
    if (!entries.length || entries.some(x => !/^\d{10}$/.test(x.phone))) {
      setMessage("Enter a valid 10-digit phone number for each golfer you want to register.");
      return;
    }
    const { data } = await cloud.auth.getSession();
    if (!data.session) { setMessage("Sign in again to continue"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/provision-golfers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ entries }),
      });
      const result = await response.json();
      setMessage(response.ok ? `Finished: ${result.results.map((x: {status: string}) => x.status).join(", ")}` : result.error);
    } catch { setMessage("Could not reach the server"); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 640, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
    <h1>DangoGolf · Register Golfers</h1>
    <p>Private administrator setup. This does not change scores or teams.</p>
    <p role="status">{message}</p>
    {players.map(p => <label key={p.id} style={{ display: "block", marginBottom: 16 }}>
      <strong>{p.name}</strong> <small>({p.id})</small>
      <input type="tel" inputMode="tel" autoComplete="off"
        placeholder="10-digit phone number"
        value={phones[p.id] ?? ""}
        onChange={e => setPhones(old => ({ ...old, [p.id]: e.target.value }))}
        style={{ display: "block", padding: 12, width: "100%", boxSizing: "border-box" }}/>
    </label>)}
    {players.length > 0 && <button disabled={busy} onClick={submit}
      style={{ padding: 14, fontSize: 16, cursor: "pointer" }}>
      {busy ? "Creating accounts…" : "Create golfer accounts"}
    </button>}
  </main>;
}
