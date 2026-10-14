"use client";
import { useEffect, useState } from "react";
import {
  Flag,
  Trophy,
  ArrowUpRight,
  ChevronRight,
  Menu,
  Check,
  Wifi,
  Plus,
  Minus,
} from "lucide-react";
import {
  State,
  Match,
  key,
  result,
  standings,
  handicap,
  strokes,
} from "../lib/scoring";
import { demo, blank } from "../lib/demo";
import { cloud } from "../lib/cloud";
import { uploadedScorecards } from "../lib/course-scorecards";
import { liveSkins, moneyLeaderboard, prizeSettings, roundSkins } from "../lib/money";
const nav = [
  "Live Scoring",
  "Live Leaderboard",
  "Live Skin Winners",
  "Today's Matches",
  "Schedule",
  "Course Scorecards",
  "Teams",
  "Matchup Draft",
  "Tournament Results",
  "Money Center",
  "Home",
  "Admin Dashboard",
];
const formats = {
  bestball: "Best Ball Match Play",
  stableford: "Combined Stableford",
  shamble: "Shamble Match Play",
  scramble: "2-Man Scramble Match Play",
  singles: "Singles Match Play",
};
export default function App() {
  const [s, setS] = useState<State>(blank()),
    [page, setPage] = useState("Live Scoring"),
    [mode, setMode] = useState<"demo" | "cloud">("cloud"),
    [round, setRound] = useState("r0"),
    [player, setPlayer] = useState("p0"),
    [hole, setHole] = useState(0),
    [gross, setGross] = useState(4),
    [notice, setNotice] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [passcode, setPasscode] = useState(""),
    [signingIn, setSigningIn] = useState(false),
    [user, setUser] = useState(""),
    [role, setRole] = useState("golfer"),
    [rev, setRev] = useState(0),
    [online, setOnline] = useState(true),
    [tv, setTv] = useState(false),
    [mobile, setMobile] = useState(false),
    [pending, setPending] = useState<
      {
        match: string;
        player: string;
        hole: number;
        gross: number;
        expected: number;
        request: string;
      }[]
    >([]);
  function enterTestMode() {
    if (!user) { setNotice("Sign in before opening Test Mode"); return; }
    const saved = localStorage.getItem("dango-test-v1");
    let testState: State;
    try { testState = saved ? JSON.parse(saved) : demo(); }
    catch { testState = demo(); }
    // Test Mode always uses fictional golfers and local-only scores.
    if (testState.players.length !== 12 || testState.players.some(p => !p.name)) testState = demo();
    setS(testState);
    setPlayer("p0");
    setRound("r0");
    setHole(0);
    setPage("Live Scoring");
    setMode("demo");
    setNotice("TEST MODE: Fictional golfers and scores stay on this device. Live tournament is unchanged.");
  }
  async function exitTestMode() {
    setMode("cloud");
    setPage("Live Scoring");
    setRound("r0");
    setHole(0);
    setNotice("Returning to live tournament…");
    if (!cloud) return;
    const { data, error } = await cloud.rpc("read_tournament");
    if (error) { setNotice("Live tournament could not load: " + error.message); return; }
    if (data) { setS(data.state); setRev(data.revision); }
    const { data: session } = await cloud.auth.getUser();
    if (session.user) {
      const { data: member } = await cloud.from("members").select("player_id,role").eq("user_id", session.user.id).single();
      if (member) { setPlayer(member.player_id); setRole(member.role); }
    }
    setNotice("LIVE TOURNAMENT: Your real tournament data is loaded.");
  }
  function resetTestMode() {
    if (!window.confirm("Reset all TEST scores and fictional pairings? Your LIVE tournament will not be affected.")) return;
    localStorage.removeItem("dango-test-v1");
    setS(demo());
    setPlayer("p0");
    setRound("r0");
    setHole(0);
    setNotice("Test tournament reset. Live data remains unchanged.");
  }
  useEffect(() => {
    const saved = localStorage.getItem("dango-scoring-hole:"+mode+":"+round+":"+player);
    if (saved !== null) {
      const n = Number(saved);
      if (Number.isInteger(n) && n >= 0 && n < 18) setHole(n);
    }
  }, [mode, round, player]);
  const admin = mode === "demo" || role === "admin";
  const captain = admin || role === "captain";
  useEffect(() => {
    const saved = localStorage.getItem("dango-test-v1");
    if (saved)
      try {
        setS(JSON.parse(saved));
      } catch {}
    const receive = (e: StorageEvent) => {
      if (e.key === "dango-test-v1" && e.newValue)
        setS(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", receive);
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("storage", receive);
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    if (mode === "demo")
      localStorage.setItem("dango-test-v1", JSON.stringify(s));
  }, [s, mode]);
  useEffect(() => {
    const saved = localStorage.getItem("myrtle-score-queue");
    if (saved)
      try {
        setPending(JSON.parse(saved));
      } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("myrtle-score-queue", JSON.stringify(pending));
  }, [pending]);
  async function load() {
    if (!cloud) return;
    const { data, error } = await cloud.rpc("read_tournament");
    if (error) {
      setNotice(error.message);
      return;
    }
    if (data) {
      setS(data.state);
      setRev(data.revision);
    }
  }
  useEffect(() => {
    if (mode !== "cloud" || !cloud) return;
    const client = cloud;
    client.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user.id);
        const { data: p } = await client
          .from("members")
          .select("player_id,role")
          .eq("user_id", data.user.id)
          .single();
        if (p) {
          setPlayer(p.player_id);
          setRole(p.role);
        }
        await load();
      }
    });
    const { data: auth } = client.auth.onAuthStateChange(() => {
      setTimeout(async () => {
        const { data } = await client.auth.getUser();
        setUser(data.user?.id ?? "");
        if (data.user) {
          const { data: p } = await client
            .from("members")
            .select("player_id,role")
            .eq("user_id", data.user.id)
            .single();
          if (p) {
            setPlayer(p.player_id);
            setRole(p.role);
          }
          load();
        }
      }, 0);
    });
    const channel = client
      .channel("tournament")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => load(),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
      auth.subscription.unsubscribe();
    };
  }, [mode]);
  async function send(item: (typeof pending)[number]) {
    if (!cloud) return false;
    const { error } = await cloud.rpc("submit_score", {
      p_match: item.match,
      p_player: item.player,
      p_hole: item.hole,
      p_gross: item.gross,
      p_expected: item.expected,
      p_request: item.request,
    });
    if (error) {
      setNotice(
        `Score not saved: ${error.message}. Your pending score remains available; review before retrying.`,
      );
      return false;
    }
    await load();
    setNotice("Score saved to tournament");
    if (page === "Live Scoring" && item.hole < 17) {
      setHole(h => h === item.hole ? h + 1 : h);
      setGross(s.rounds.find(r => r.id === round)?.holes[item.hole + 1]?.par ?? 4);
    }
    return true;
  }
  useEffect(() => {
    if (mode !== "cloud" || !online || !user || !pending.length) return;
    let cancelled = false;
    (async () => {
      const item = pending[0];
      if ((await send(item)) && !cancelled)
        setPending((q) => q.filter((x) => x.request !== item.request));
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, online, user, pending.length, pending[0]?.request]);
  async function update(next: State, message: string) {
    next = {
      ...next,
      audit: [{ at: new Date().toISOString(), message }, ...next.audit],
    };
    if (mode === "demo") {
      setS(next);
      setNotice("Saved in demo");
      return;
    }
    if (!cloud || !admin) {
      setNotice("Administrator access required");
      return;
    }
    const { error } = await cloud.rpc("update_tournament", {
      p_state: next,
      p_expected: rev,
    });
    if (error) {
      setNotice(`Changes not saved: ${error.message}`);
      await load();
    } else {
      await load();
      setNotice("Tournament saved");
    }
  }
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const roundDates = s.rounds.map((x) => x.date).join(",");
  useEffect(() => {
    if (page === "Home" || page === "Live Scoring") {
      const today = s.rounds.filter((x) => x.date === localDate);
      if (today.length) {
        const upcoming = today.find((x) => x.times.some((t) => t >= localTime));
        setRound((upcoming ?? today[today.length - 1]).id);
      }
    }
  }, [page, roundDates, localDate]);
  const totals = standings(s),
    r = s.rounds.find((x) => x.id === round) ?? s.rounds[0],
    matches = s.matches.filter((m) => m.round === r.id),
    mine = matches.find((m) => [...m.a, ...m.b].includes(player));
  const names = (ids: string[]) =>
    ids
      .map((id) => s.players.find((p) => p.id === id)?.name ?? "Unassigned")
      .join(" / ");
  function card(m: Match) {
    const x = result(s, m);
    return (
      <article className="match" key={m.id}>
        <div className="eyebrow">
          {s.rounds.find((r) => r.id === m.round)?.name}{" "}
          <span>
            {x.complete ? "FINAL" : x.played ? `THRU ${x.played}` : "UPCOMING"}
          </span>
        </div>
        <div className="versus">
          <b>{names(m.a)}</b>
          <small>VS</small>
          <b>{names(m.b)}</b>
        </div>
        {s.rounds.find((r) => r.id === m.round)?.format === "stableford" && (
          <p className="individual-points">
            {[...m.a, ...m.b]
              .map((id) => `${names([id])}: ${x.individual[id] ?? 0} pts`)
              .join(" · ")}
          </p>
        )}
        <div className="match-bottom">
          <strong>{x.status}</strong>
          <span>
            {x.complete
              ? `${x.points[0]} – ${x.points[1]} points`
              : s.rounds.find((r) => r.id === m.round)?.times[m.slot]}
          </span>
        </div>
      </article>
    );
  }
  async function saveScore() {
    if (!mine) return;
    if (
      !r.locked ||
      !mine.approved ||
      r.holes.length !== 18 ||
      (mode === "cloud" && !r.verified)
    ) {
      setNotice(
        "Approved, locked pairings and a verified 18-hole scorecard are required",
      );
      return;
    }
    const scoringPlayer = r.format === "scramble" ? (mine.a.includes(player) ? mine.a[0] : mine.b[0]) : player;
    const k = key(mine.id, scoringPlayer, hole),
      expected = s.scores[k]?.version ?? 0;
    if (mode === "demo") {
      const latest = JSON.parse(
        localStorage.getItem("dango-test-v1") ?? JSON.stringify(s),
      );
      if ((latest.scores[k]?.version ?? 0) !== expected) {
        setS(latest);
        setNotice(
          "Conflict: score changed on another tab. Review it before saving.",
        );
        return;
      }
      await update(
        {
          ...s,
          scores: { ...s.scores, [k]: { gross, version: expected + 1 } },
        },
        `${names([player])}: hole ${hole + 1} → ${gross}`,
      );
      if (hole < 17) { setHole(hole + 1); setGross(r.holes[hole + 1].par); }
    } else {
      setPending((q) => [
        ...q,
        {
          match: mine.id,
          player: scoringPlayer,
          hole,
          gross,
          expected,
          request: crypto.randomUUID(),
        },
      ]);
      setNotice("Score queued securely for synchronization");
    }
  }
  function roundPicker() {
    return (
      <div className="tabs">
        {s.rounds.map((x, i) => (
          <button
            className={round === x.id ? "selected" : ""}
            key={x.id}
            onClick={() => {
              setRound(x.id);
              setHole(0);
            }}
          >
            R{i + 1} · {x.name}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div
      className={(tv ? "shell tv" : "shell") + (page === "Live Scoring" ? " scoring-page" : "")}
      style={
        {
          "--team-a": s.teams[0].color,
          "--team-b": s.teams[1].color,
        } as React.CSSProperties
      }
    >
      {!tv && (
        <aside className={mobile ? "open" : ""}>
          <div className="brand">
            <Flag size={28} />
            <div>
              DANGO GOLF<small>MYRTLE BEACH CHAMPIONSHIP</small>
            </div>
          </div>
          <div className="edition">🇺🇸 USA  VS  EUROPE 🇪🇺 · 2026</div>
          <nav>
            {nav.map((n, i) => (
              <button
                className={page === n ? "active" : ""}
                key={n}
                onClick={() => {
                  setPage(n);
                  setMobile(false);
                }}
              >
                <span className={i % 3 === 0 ? "nav-icon-gold" : "nav-icon-white"}>{["✎", "▥", "★", "⚑", "▦", "♧", "⇄", "♜", "🏆", "$", "⌂", "⚙"][i]}</span>
                {n}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="avatar">MB</div>
            <b>Five rounds. One champion.</b>
            <small>Myrtle Beach, South Carolina</small>
          </div>
        </aside>
      )}
      <main>
        <header>
          <button className="mobile-menu" onClick={() => setMobile(!mobile)}>
            <Menu />
          </button>
          <span>
            MYRTLE BEACH <span className="muted">/ {page}</span>
          </span>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {user && (mode === "cloud"
              ? <button type="button" onClick={enterTestMode} style={{padding:"7px 12px",border:"1px solid #d5b56a",borderRadius:8,fontWeight:700}}>🧪 Enter Test Mode</button>
              : <>
                  <button type="button" onClick={resetTestMode} style={{padding:"7px 12px",border:"1px solid #d5b56a",borderRadius:8}}>Reset Test</button>
                  <button type="button" onClick={exitTestMode} style={{padding:"7px 12px",border:"1px solid #d5b56a",borderRadius:8,fontWeight:700}}>Return to LIVE</button>
                </>)}
            <span className="connection">
              <i />
              {mode === "demo" ? "DEMO MODE" : online ? "CONNECTED" : "OFFLINE"}
            </span>

          </div>
        </header>
        <div className="content">
          {mode === "demo" && <div role="status" style={{padding:12,marginBottom:16,border:"2px solid #d5b56a",borderRadius:8,fontWeight:700}}>🧪 TEST MODE — Fictional golfers. Scores and changes are saved only on this device. NOT THE LIVE TOURNAMENT.</div>}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {mode === "cloud" && !user ? (
            <section className="panel">
              <h1>Your championship starts here.</h1>
              <p>Enter your registered phone number and tournament code.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!cloud || signingIn) return;
                setSigningIn(true);
                try {
                  const response = await fetch("/api/phone-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone, code: passcode }),
                  });
                  const data = await response.json();
                  if (!response.ok) { setNotice(data.error || "Sign-in failed"); return; }
                  const { error } = await cloud.auth.setSession({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                  });
                  setNotice(error?.message || "Welcome to DangoGolf!");
                } catch {
                  setNotice("Unable to sign in. Please try again.");
                } finally {
                  setSigningIn(false);
                }
              }}>
                <input type="tel" autoComplete="tel" inputMode="tel"
                  placeholder="Phone number" aria-label="Phone number"
                  value={phone} onChange={(e) => setPhone(e.target.value)} required />
                <input type="password" inputMode="numeric" maxLength={4}
                  placeholder="4-digit tournament code" aria-label="Tournament code"
                  value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
                <button type="submit" className="primary" disabled={signingIn}>
                  {signingIn ? "Signing in…" : "Enter Tournament"}
                </button>
              </form>
              <details style={{ marginTop: 24 }}>
                <summary>Existing email sign-in (temporary backup)</summary>
                <input type="email" placeholder="Your email address"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <button onClick={async () => {
                  const { error } = await cloud!.auth.signInWithOtp({
                    email, options: { shouldCreateUser: false, emailRedirectTo: location.origin },
                  });
                  setNotice(error?.message ?? "Check your email for a sign-in link");
                }}>Send sign-in link</button>
              </details>
            </section>
          ) : (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">
                    OCTOBER TRADITION. CHAMPIONSHIP AMBITION.
                  </div>
                  <h1>{page === "Home" ? "The road to 9½." : page}</h1>
                  <p>
                    Myrtle Beach Golf Championship 2026 <span>•</span> 12
                    golfers <span>•</span> 5 rounds <span>•</span> 18 points
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTv(!tv);
                    setPage("Live Leaderboard");
                    if (!tv)
                      document.documentElement
                        .requestFullscreen?.()
                        .catch(() => {});
                    else if (document.fullscreenElement)
                      document.exitFullscreen?.();
                  }}
                >
                  {tv ? "Exit TV mode" : "TV leaderboard"}{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              {["Home", "Live Leaderboard", "Tournament Results"].includes(
                page,
              ) && (
                <>
                  <section className="scoreboard">
                    <div className="scoreboard-top">
                      <span>
                        <i />{" "}
                        {totals.winner
                          ? "TOURNAMENT RESULT"
                          : "LIVE TOURNAMENT STANDINGS"}
                      </span>
                      <span>FIRST TO 9½ WINS</span>
                    </div>
                    <div className="score-line">
                      <div className="team team-a">
                        <div className="crest">
                          {s.teams[0].name.slice(0, 1)}
                        </div>
                        <div>
                          <small>TEAM A</small>
                          <h2>{s.teams[0].name}</h2>
                        </div>
                      </div>
                      <div className="points">
                        {totals.official[0]}
                        <span>—</span>
                        {totals.official[1]}
                      </div>
                      <div className="team team-b">
                        <div>
                          <small>TEAM B</small>
                          <h2>{s.teams[1].name}</h2>
                        </div>
                        <div className="crest">
                          {s.teams[1].name.slice(0, 1)}
                        </div>
                      </div>
                    </div>
                    <div className="race">
                      <div
                        style={{ width: `${(totals.official[0] / 18) * 100}%` }}
                      />
                      <span
                        style={{ width: `${(totals.official[1] / 18) * 100}%` }}
                      />
                    </div>
                    <div className="scoreboard-bottom">
                      <span>
                        {totals.winner ??
                          (totals.official[0] === totals.official[1]
                            ? "The championship is level"
                            : `${s.teams[totals.official[0] > totals.official[1] ? 0 : 1].name} leads the championship`)}
                      </span>
                      <small>{totals.remaining} POINTS STILL AVAILABLE</small>
                    </div>
                  </section>
                  <div className="stats">
                    <div>
                      <small>MATCHES COMPLETE</small>
                      <b>
                        {totals.complete}
                        <span> / 18</span>
                      </b>
                    </div>
                    <div>
                      <small>PROJECTED IF LEADS HOLD</small>
                      <b>
                        {totals.projected[0]} <span>—</span>{" "}
                        {totals.projected[1]}
                      </b>
                      <small>Projection only · excludes unplayed matches</small>
                    </div>
                    <div>
                      <small>POINTS NEEDED TO WIN</small>
                      <b>
                        {Math.max(0, 9.5 - totals.official[0])} <span>/</span>{" "}
                        {Math.max(0, 9.5 - totals.official[1])}
                      </b>
                    </div>
                  </div>
                </>
              )}
              {page === "Home" && (
                <>
                  <div className="section-heading">
                    <h2>On the course</h2>
                    <button onClick={() => setPage("Today's Matches")}>
                      All matches <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="home-grid">
                    <section className="course-feature">
                      <div className="eyebrow">
                        ROUND {s.rounds.indexOf(r) + 1} ·{" "}
                        {r.date || "DATE TO BE CONFIRMED"}
                      </div>
                      <Flag size={40} />
                      <h2>{r.name}</h2>
                      <p>{formats[r.format]}</p>
                      <div className="course-meta">
                        <span>
                          NEXT TEE TIME
                          <b>
                            {r.date === localDate
                              ? (r.times.find((t) => t >= localTime) ??
                                "All started")
                              : r.times[0]}
                          </b>
                          <small>America/New_York</small>
                        </span>
                        <button
                          className="primary"
                          onClick={() => setPage("Live Scoring")}
                        >
                          Enter scores <ArrowUpRight size={18} />
                        </button>
                      </div>
                    </section>
                    <div className="match-list">
                      {matches.slice(0, 3).map(card)}
                    </div>
                  </div>
                  <div className="section-heading">
                    <h2>The championship journey</h2>
                    <button onClick={() => setPage("Schedule")}>
                      Full schedule <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="journey">
                    {s.rounds.map((r, i) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRound(r.id);
                          setPage("Today's Matches");
                        }}
                      >
                        <small>ROUND 0{i + 1}</small>
                        <h3>{r.name}</h3>
                        <p>{formats[r.format]}</p>
                        <b>
                          {i === 4 ? "6" : "3"} points{" "}
                          <ArrowUpRight size={14} />
                        </b>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {[
                "Live Leaderboard",
                "Today's Matches",
                "Tournament Results",
              ].includes(page) && (
                <>
                  {page === "Tournament Results" && (
                    <section className="panel">
                      <h2>Round-by-round results</h2>
                      <table>
                        <thead>
                          <tr>
                            <th>Round</th>
                            <th>{s.teams[0].name}</th>
                            <th>{s.teams[1].name}</th>
                            <th>Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.rounds.map((rr, i) => {
                            const results = s.matches
                              .filter((m) => m.round === rr.id)
                              .map((m) => result(s, m));
                            return (
                              <tr key={rr.id}>
                                <th>
                                  {i + 1} · {rr.name}
                                </th>
                                <td>
                                  {results.reduce((v, x) => v + x.points[0], 0)}
                                </td>
                                <td>
                                  {results.reduce((v, x) => v + x.points[1], 0)}
                                </td>
                                <td>
                                  {results.filter((x) => x.complete).length} /{" "}
                                  {rr.format === "singles" ? 6 : 3}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </section>
                  )}
                  {roundPicker()}
                  <div className="match-grid">{matches.map(card)}</div>
                  {!matches.length && <p>Pairings have not been assigned.</p>}
                </>
              )}
              {page === "Live Scoring" && (
                <>
                  {roundPicker()}
                  <section className="panel">
                    {mode === "demo" || admin ? (
                      <label>
                        Scoring as{" "}
                        <select
                          value={player}
                          onChange={(e) => setPlayer(e.target.value)}
                        >
                          {s.players.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <h2>{names([player])}</h2>
                    )}
                    {mine && r.holes.length === 18 ? (
                      <>
                        <div className="section-heading">
                          <h2>{r.name}</h2>
                          <span>{result(s, mine).status}</span>
                        </div>
                        <FoursomeScoreEntry state={s} round={r} matches={matches} player={player} hole={hole} setHole={setHole} mode={mode} onSaved={async(next)=>{if(mode==="demo"){setS(next);localStorage.setItem("dango-test-v1",JSON.stringify(next));}else await load();}} onNotice={setNotice}/>
                      </>
                    ) : (
                      <p>Your match or course scorecard is not ready yet.</p>
                    )}
                  </section>
                </>
              )}
              {page === "Course Scorecards" && (
                <div className="schedule">
                  <section className="panel">
                    <h2>Course Scorecards</h2>
                    <p>All five Road to 9.5 courses. Select a course to view its full 18-hole scorecard.</p>
                    <label>
                      Choose course
                      <select value={round} onChange={(e) => setRound(e.target.value)}>
                        {s.rounds.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.tee || "Tees pending"}</option>)}
                      </select>
                    </label>
                  </section>
                  {s.rounds.filter(x => x.id === round).map(x => (
                    <section className="panel" key={x.id}>
                      <h2>{x.name}</h2>
                      <p>{formats[x.format]}</p>
                      <CourseScorecard course={x} />
                    </section>
                  ))}
                </div>
              )}
              {page === "Schedule" && (
                <div className="schedule">
                  {s.rounds.map((x, i) => (
                    <section className="panel" key={x.id}>
                      <div className="eyebrow">
                        ROUND 0{i + 1} · {i === 4 ? 6 : 3} POINTS
                      </div>
                      <h2>{x.name}</h2>
                      <p>{formats[x.format]}</p>
                      <p>
                        {x.date || "Calendar date to be confirmed"} ·
                        America/New_York
                      </p>
                      <CourseScorecard course={x} />
                      <div className="tee-times">
                        {x.times.map((t, j) => (
                          <div key={j}>
                            <b>{t}</b>
                            {s.matches
                              .filter((m) => m.round === x.id && m.slot === j)
                              .map((m) => (
                                <small key={m.id}>
                                  {names(m.a)} vs. {names(m.b)}
                                </small>
                              ))}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              {page === "Teams" && (
                <div className="team-grid">
                  {s.teams.map((t, i) => (
                    <section className="panel" key={i}>
                      <div className="eyebrow">
                        TEAM {i === 0 ? "A" : "B"} ·{" "}
                        {s.players.filter((p) => p.team === i).length} / 6
                        GOLFERS
                      </div>
                      <h2 style={{ color: t.color }}>{t.name}</h2>
                      {s.players
                        .filter((p) => p.team === i)
                        .map((p) => {
                          const rec = s.matches
                            .filter((m) => [...m.a, ...m.b].includes(p.id))
                            .map((m) => result(s, m))
                            .filter((x) => x.complete);
                          return (
                            <div className="player-row" key={p.id}>
                              <div className="avatar">
                                {p.avatar ? (
                                  <img src={p.avatar} alt="" />
                                ) : (
                                  p.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                )}
                              </div>
                              <div>
                                <b>
                                  {p.name} {p.captain && "★"}
                                </b>
                                <small>
                                  {p.captain ? "Captain · " : ""}Index{" "}
                                  {p.index.toFixed(1)} ·{" "}
                                  {rec.filter((x) => x.points[i] === 1).length}W
                                  /{" "}
                                  {rec.filter((x) => x.points[i] === 0).length}L
                                  /{" "}
                                  {
                                    rec.filter((x) => x.points[i] === 0.5)
                                      .length
                                  }
                                  T
                                </small>
                                <small>
                                  Stableford:{" "}
                                  {s.matches
                                    .filter(
                                      (m) =>
                                        m.round ===
                                          s.rounds.find(
                                            (r) => r.format === "stableford",
                                          )?.id &&
                                        [...m.a, ...m.b].includes(p.id),
                                    )
                                    .reduce(
                                      (v, m) =>
                                        v +
                                        (result(s, m).individual[p.id] ?? 0),
                                      0,
                                    )}
                                </small>
                              </div>
                            </div>
                          );
                        })}
                    </section>
                  ))}
                </div>
              )}
              {page === "Matchup Draft" && (
                <>
                  {roundPicker()}
                  <section className="panel">
                    <h2>Captain’s matchup desk</h2>
                    <p>
                      Nominate a {r.format === "singles" ? "golfer" : "pair"},
                      then have the opposing captain select the challengers.
                      Drafts stay editable until administrator approval.
                    </p>
                    {captain && !r.locked ? (
                      <Draft
                        state={s}
                        round={round}
                        role={role}
                        player={player}
                        onSave={(m) => {
                          const next = {
                            ...s,
                            matches: [
                              ...s.matches.filter((x) => x.id !== m.id),
                              m,
                            ],
                          };
                          if (mode === "demo" || admin)
                            update(next, "Pairing draft saved");
                          else
                            cloud!
                              .rpc("save_draft", { p_match: m })
                              .then(({ error }) => {
                                setNotice(error?.message ?? "Draft saved");
                                load();
                              });
                        }}
                      />
                    ) : (
                      <p>
                        {r.locked
                          ? "Pairings are locked. An administrator can reopen the draft."
                          : "Captain access required."}
                      </p>
                    )}
                    {matches.map(card)}
                    {admin && (
                      <button
                        className="primary"
                        onClick={() => {
                          const assigned = matches.flatMap((m) => [
                            ...m.a,
                            ...m.b,
                          ]);
                          if (
                            !r.locked &&
                            (matches.length !==
                              (r.format === "singles" ? 6 : 3) ||
                              new Set(assigned).size !== 12 ||
                              s.players.length !== 12 ||
                              s.teams.some(
                                (_, i) =>
                                  s.players.filter((p) => p.team === i)
                                    .length !== 6 ||
                                  s.players.filter(
                                    (p) => p.team === i && p.captain,
                                  ).length !== 1,
                              ) ||
                              matches.some(
                                (m) =>
                                  m.a.length !==
                                    (r.format === "singles" ? 1 : 2) ||
                                  m.b.length !==
                                    (r.format === "singles" ? 1 : 2) ||
                                  m.a.some(
                                    (id) =>
                                      s.players.find((p) => p.id === id)
                                        ?.team !== 0,
                                  ) ||
                                  m.b.some(
                                    (id) =>
                                      s.players.find((p) => p.id === id)
                                        ?.team !== 1,
                                  ),
                              ) ||
                              [0, 1, 2].some(
                                (slot) =>
                                  matches.filter((m) => m.slot === slot)
                                    .length !==
                                  (r.format === "singles" ? 2 : 1),
                              ))
                          ) {
                            setNotice(
                              "Require 12 unique golfers, six per team, one captain per team, and all matches complete",
                            );
                            return;
                          }
                          update(
                            {
                              ...s,
                              rounds: s.rounds.map((x) =>
                                x.id === round
                                  ? { ...x, locked: !x.locked }
                                  : x,
                              ),
                              matches: s.matches.map((m) =>
                                m.round === round
                                  ? { ...m, approved: !r.locked }
                                  : m,
                              ),
                            },
                            r.locked
                              ? "Pairings unlocked"
                              : "Pairings approved and locked",
                          );
                        }}
                      >
                        {r.locked
                          ? "Unlock pairings"
                          : "Approve and lock pairings"}
                      </button>
                    )}
                  </section>
                </>
              )}
              {page === "Live Skin Winners" && <LiveSkinWinners state={s} />}
              {page === "Money Center" && <MoneyCenter state={s} admin={admin} onSave={update} />}
              {page === "Admin Dashboard" &&
                (admin ? (
                  <Admin
                    state={s}
                    onSave={update}
                    round={round}
                    setRound={setRound}
                    mode={mode}
                  />
                ) : (
                  <section className="panel">
                    Administrator authorization required.
                  </section>
                ))}
            </>
          )}
          <footer>
            <Flag size={16} /> MYRTLE BEACH 2026{" "}
            <span>Good golf. Great company. A little friendly rivalry.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Draft({
  state: s,
  round,
  role,
  player,
  onSave,
}: {
  state: State;
  round: string;
  role: string;
  player: string;
  onSave: (m: Match) => void;
}) {
  const r = s.rounds.find((x) => x.id === round)!;
  const [slot, setSlot] = useState(0),
    [first, setFirst] = useState<0 | 1>(0),
    [a, setA] = useState<string[]>([]),
    [b, setB] = useState<string[]>([]);
  const size = r.format === "singles" ? 1 : 2;
  const existing = s.matches.find(
    (m) =>
      m.round === round &&
      (m.position ?? Number(m.id.split("-").at(-1))) === slot,
  );
  useEffect(() => {
    setA(existing?.a ?? []);
    setB(existing?.b ?? []);
    setFirst(existing?.nomination ?? r.nomination ?? 0);
  }, [
    round,
    slot,
    existing?.id,
    existing?.a.join(","),
    existing?.b.join(","),
    r.nomination,
  ]);
  const team = s.players.find((p) => p.id === player)?.team;
  return (
    <div className="draft">
      <label>
        Match number
        <select
          value={slot}
          onChange={(e) => {
            setSlot(+e.target.value);
            setA([]);
            setB([]);
          }}
        >
          {Array.from({ length: size === 1 ? 6 : 3 }, (_, i) => (
            <option key={i} value={i}>
              Match {i + 1}
            </option>
          ))}
        </select>
      </label>
      {role === "admin" || role === "golfer" ? (
        <label>
          Nominating team
          <select
            value={first}
            onChange={(e) => setFirst(+e.target.value as 0 | 1)}
          >
            {s.teams.map((t, i) => (
              <option key={i} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>Nominating team: {s.teams[existing?.nomination ?? first].name}</p>
      )}
      {s.teams.map((t, i) => (
        <fieldset key={i}>
          <legend>
            {t.name} · select {size}
          </legend>
          {s.players
            .filter((p) => p.team === i)
            .map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={(i === 0 ? a : b).includes(p.id)}
                  disabled={
                    role === "captain" &&
                    (team !== i || (i !== first && !existing))
                  }
                  onChange={(e) => {
                    const v = i === 0 ? a : b;
                    const next = e.target.checked
                      ? [...v, p.id]
                      : v.filter((id) => id !== p.id);
                    if (next.length <= size) (i === 0 ? setA : setB)(next);
                  }}
                />
                {p.name}
              </label>
            ))}
        </fieldset>
      ))}
      <button
        className="primary"
        onClick={() => {
          const aa = role === "captain" && team === 1 ? (existing?.a ?? []) : a;
          const bb = role === "captain" && team === 0 ? (existing?.b ?? []) : b;
          if ((first === 0 ? aa : bb).length !== size) return;
          onSave({
            id: existing?.id ?? `draft-${round}-${slot}`,
            round,
            a: aa,
            b: bb,
            position: slot,
            slot: existing?.slot ?? (size === 1 ? Math.floor(slot / 2) : slot),
            approved: false,
            nomination: first,
          });
        }}
      >
        Save matchup draft
      </button>
    </div>
  );
}
function Admin({
  state: s,
  onSave,
  round,
  setRound,
  mode,
}: {
  state: State;
  onSave: (s: State, message: string) => void;
  round: string;
  setRound: (s: string) => void;
  mode: string;
}) {
  const [edit, setEdit] = useState(s),
    [json, setJson] = useState(""),
    [error, setError] = useState("");
  useEffect(() => setEdit(s), [s]);
  const r = edit.rounds.find((x) => x.id === round)!;
  const modify = (v: Partial<typeof r>) =>
    setEdit({
      ...edit,
      rounds: edit.rounds.map((x) => (x.id === round ? { ...x, ...v } : x)),
    });
  return (
    <div className="admin">
      <section className="panel">
        <h2>Teams & roster</h2>
        <p>
          Enter six golfers per team and choose one captain each. Course
          handicap overrides use the round ID (r0–r4).
        </p>
        {edit.teams.map((t, i) => (
          <div className="form-row" key={i}>
            <input
              aria-label="Team name"
              value={t.name}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  teams: edit.teams.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              type="color"
              aria-label="Team color"
              value={t.color}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  teams: edit.teams.map((x, j) =>
                    j === i ? { ...x, color: e.target.value } : x,
                  ),
                })
              }
            />
          </div>
        ))}
        {edit.players.map((p, i) => (
          <div className="roster-edit" key={p.id}>
            <input
              aria-label="Player name"
              value={p.name}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  players: edit.players.map((x, j) =>
                    i === j ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <label>
              Index
              <input
                type="number"
                step="0.1"
                value={p.index}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    players: edit.players.map((x, j) =>
                      i === j ? { ...x, index: +e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <select
              aria-label="Team"
              value={p.team}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  players: edit.players.map((x, j) =>
                    i === j ? { ...x, team: +e.target.value as 0 | 1 } : x,
                  ),
                })
              }
            >
              {edit.teams.map((t, i) => (
                <option key={i} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={p.captain}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    players: edit.players.map((x, j) =>
                      i === j ? { ...x, captain: e.target.checked } : x,
                    ),
                  })
                }
              />
              Captain
            </label>
            <input
              placeholder="Avatar URL"
              value={p.avatar}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  players: edit.players.map((x, j) =>
                    i === j ? { ...x, avatar: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              type="number"
              placeholder="CH override this round"
              value={p.overrides[round] ?? ""}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  players: edit.players.map((x, j) => {
                    if (i !== j) return x;
                    const overrides = { ...x.overrides };
                    if (e.target.value === "") delete overrides[round];
                    else overrides[round] = +e.target.value;
                    return { ...x, overrides };
                  }),
                })
              }
            />
            <button
              onClick={() => {
                if (edit.matches.some((m) => [...m.a, ...m.b].includes(p.id))) {
                  setError("Remove this player from pairings first");
                  return;
                }
                setEdit({
                  ...edit,
                  players: edit.players.filter((x) => x.id !== p.id),
                });
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            edit.players.length < 12 &&
            setEdit({
              ...edit,
              players: [
                ...edit.players,
                {
                  id: crypto.randomUUID(),
                  name: "New golfer",
                  index: 0,
                  team:
                    edit.players.filter((p) => p.team === 0).length < 6 ? 0 : 1,
                  captain: false,
                  avatar: "",
                  overrides: {},
                },
              ],
            })
          }
        >
          + Add golfer
        </button>
        <button
          className="primary"
          onClick={() => onSave(edit, "Roster and team settings updated")}
        >
          Save roster
        </button>
      </section>
      <section className="panel">
        <h2>Rounds, verified scorecards & tee times</h2>
        <select value={round} onChange={(e) => setRound(e.target.value)}>
          {edit.rounds.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <div className="form-row">
          <label>
            Course
            <input
              value={r.name}
              onChange={(e) => modify({ name: e.target.value })}
            />
          </label>
          <label>
            Local date
            <input
              type="date"
              value={r.date}
              onChange={(e) => modify({ date: e.target.value })}
            />
          </label>
          <label>
            Format
            <select
              value={r.format}
              onChange={(e) =>
                modify({ format: e.target.value as typeof r.format })
              }
            >
              {Object.entries(formats).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          {r.times.map((t, i) => (
            <label key={i}>
              Foursome {i + 1}
              <input
                type="time"
                value={t}
                onChange={(e) =>
                  modify({
                    times: r.times.map((x, j) =>
                      i === j ? e.target.value : x,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="form-row">
          <label>
            Tee box
            <input
              value={r.tee}
              onChange={(e) => modify({ tee: e.target.value })}
            />
          </label>
          <label>
            Course rating
            <input
              type="number"
              step=".1"
              value={r.rating}
              onChange={(e) => modify({ rating: +e.target.value })}
            />
          </label>
          <label>
            Slope
            <input
              type="number"
              value={r.slope}
              onChange={(e) => modify({ slope: +e.target.value })}
            />
          </label>
          <label>
            First nominating captain
            <select
              value={r.nomination ?? 0}
              onChange={(e) => modify({ nomination: +e.target.value as 0 | 1 })}
            >
              {edit.teams.map((t, i) => (
                <option key={i} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shamble scoring
            <select
              value={r.shamble}
              onChange={(e) =>
                modify({ shamble: e.target.value as "best" | "combined" })
              }
            >
              <option value="best">Lowest net ball</option>
              <option value="combined">Combined net</option>
            </select>
          </label>
        </div>
        <CourseScorecard course={r} />
        <p>Uploaded official scorecard available for this course. Loads the correct selected tee, all 18 pars, stroke indexes, yardages, rating and slope. Review it before marking verified and saving.</p>
        <button type="button" onClick={()=>{
          const card=uploadedScorecards[round];
          if (!card) {setError("No uploaded scorecard for this round");return;}
          if (Object.keys(edit.scores).some(k=>edit.matches.some(m=>m.round===round&&k.startsWith(m.id+":")))) {
            setError("Existing scores detected. Course configuration must be reviewed before replacing the scorecard.");
            return;
          }
          modify({...card,verified:false});
          setError("Scorecard loaded from published course information. Review the data, then mark verified if confirmed and save.");
        }}>Load uploaded {uploadedScorecards[round]?.tee ?? ""} tee scorecard</button>
        <p>
          Import verified holes as JSON: [{'{"par":4,"rank":1,"yards":400}'},
          …18 holes]. Or use the official scorecard loader above.
        </p>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder="Paste verified 18-hole JSON"
        />
        <button
          onClick={() => {
            try {
              const h = JSON.parse(json);
              if (
                !Array.isArray(h) ||
                h.length !== 18 ||
                new Set(h.map((x) => x.rank)).size !== 18 ||
                h.some(
                  (x) =>
                    !Number.isInteger(x.par) ||
                    x.par < 3 ||
                    x.par > 6 ||
                    !Number.isInteger(x.rank) ||
                    x.rank < 1 ||
                    x.rank > 18 ||
                    !Number.isFinite(x.yards) ||
                    x.yards <= 0,
                )
              )
                throw Error(
                  "Require 18 valid holes, unique stroke indices 1–18, and positive yardages",
                );
              modify({ holes: h });
              setError("Imported; verify and save below");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Import scorecard
        </button>
        <label>
          <input
            type="checkbox"
            checked={r.verified}
            onChange={(e) => modify({ verified: e.target.checked })}
          />
          I verified this scorecard against the course’s official tee data
        </label>
        <button
          className="primary"
          onClick={() => {
            if (
              r.verified &&
              (r.holes.length !== 18 ||
                r.slope < 55 ||
                r.slope > 155 ||
                r.rating <= 0)
            ) {
              setError(
                "Verified course requires valid holes, rating, and slope 55–155",
              );
              return;
            }
            onSave(edit, "Round configuration updated");
          }}
        >
          Save round settings
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
      <section className="panel">
        <h2>Match administration</h2>
        <p>
          Point overrides are explicit adjudications: A wins = 1, B wins = 0,
          halve = 0.5.
        </p>
        {edit.matches
          .filter((m) => m.round === round)
          .map((m) => (
            <div className="form-row" key={m.id}>
              <b>{m.id}</b>
              <label>
                Foursome
                <select
                  value={m.slot}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      matches: edit.matches.map((x) =>
                        x.id === m.id ? { ...x, slot: +e.target.value } : x,
                      ),
                    })
                  }
                >
                  {[0, 1, 2].map((i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Official result
                <select
                  value={m.manual ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      matches: edit.matches.map((x) =>
                        x.id === m.id
                          ? {
                              ...x,
                              manual:
                                e.target.value === ""
                                  ? undefined
                                  : (+e.target.value as 0 | 0.5 | 1),
                              reopened: false,
                            }
                          : x,
                      ),
                    })
                  }
                >
                  <option value="">Automatic</option>
                  <option value="1">Team A wins</option>
                  <option value="0">Team B wins</option>
                  <option value="0.5">Halved</option>
                </select>
              </label>
              <button
                onClick={() =>
                  onSave(
                    {
                      ...edit,
                      matches: edit.matches.map((x) =>
                        x.id === m.id
                          ? { ...x, reopened: !x.reopened, manual: undefined }
                          : x,
                      ),
                    },
                    "Match reopened/finalized",
                  )
                }
              >
                {m.reopened ? "Resume automatic result" : "Reopen match"}
              </button>
              <button
                onClick={() =>
                  setEdit({
                    ...edit,
                    matches: edit.matches.filter((x) => x.id !== m.id),
                  })
                }
              >
                Remove pairing
              </button>
            </div>
          ))}
        <button
          className="primary"
          onClick={() =>
            onSave(edit, "Match results and tee assignments updated")
          }
        >
          Save match administration
        </button>
      </section>
      <section className="panel">
        <h2>Scoring & administration history</h2>
        {s.audit.map((x, i) => (
          <div className="audit" key={i}>
            <time>
              {new Date(x.at).toLocaleString("en-US", {
                timeZone: "America/New_York",
              })}
            </time>
            <span>{x.message}</span>
          </div>
        ))}
        {mode === "demo" && (
          <button onClick={() => onSave(demo(), "Demo reset")}>
            Reset demonstration
          </button>
        )}
      </section>
    </div>
  );
}


function FoursomeScoreEntry({state,round,matches,player,hole,setHole,mode,onSaved,onNotice}:{
  state:State;round:State["rounds"][number];matches:Match[];player:string;hole:number;
  setHole:(n:number)=>void;mode:"demo"|"cloud";onSaved:(next:State)=>Promise<void>;
  onNotice:(message:string)=>void;
}) {
  const mine=matches.find(m=>[...m.a,...m.b].includes(player));
  const group=mine?matches.filter(m=>m.slot===mine.slot):[];
  const entries=group.flatMap(m=>round.format==="scramble"
    ?[{match:m.id,player:m.a[0],label:m.a.map(id=>state.players.find(p=>p.id===id)?.name??id).join(" / ")},
      {match:m.id,player:m.b[0],label:m.b.map(id=>state.players.find(p=>p.id===id)?.name??id).join(" / ")}]
    :[...m.a,...m.b].map(id=>({match:m.id,player:id,label:state.players.find(p=>p.id===id)?.name??id})));
  const [values,setValues]=useState<Record<string,number>>({});
  const [saving,setSaving]=useState(false);
  const [showCard,setShowCard]=useState(false);
  const signature=round.id+":"+group.map(m=>m.id).join(",")+":"+hole;
  useEffect(()=>{setValues({});},[signature]);
  const scoreFor=(e:typeof entries[number])=>values[e.match+":"+e.player]??state.scores[key(e.match,e.player,hole)]?.gross??round.holes[hole]?.par??4;
  const change=(e:typeof entries[number],delta:number)=>{setValues(v=>({...v,[e.match+":"+e.player]:Math.min(30,Math.max(1,scoreFor(e)+delta))}));};
  async function saveAll(){
    if(!mine||saving)return;
    if(!round.locked||!round.verified&&mode==="cloud"||round.holes.length!==18||group.some(m=>!m.approved)){onNotice("Verified course and locked approved pairings required");return;}
    const batch=entries.map(e=>({match:e.match,player:e.player,hole,gross:scoreFor(e),expected:state.scores[key(e.match,e.player,hole)]?.version??0}));
    setSaving(true);
    try{
      if(mode==="demo"){
        const saved=localStorage.getItem("dango-test-v1");
        const latest:State=saved?JSON.parse(saved):state;
        if(batch.some(e=>(latest.scores[key(e.match,e.player,e.hole)]?.version??0)!==e.expected))throw Error("A score changed. Reload and review before saving.");
        const scores={...latest.scores};
        batch.forEach(e=>{scores[key(e.match,e.player,e.hole)]={gross:e.gross,version:e.expected+1};});
        await onSaved({...latest,scores});
      }else{
        if(!cloud)throw Error("Not connected");
        const {error}=await cloud.rpc("submit_foursome_scores",{p_entries:batch,p_request:crypto.randomUUID()});
        if(error)throw error;
        await onSaved(state);
      }
      onNotice("All "+entries.length+" scores saved for hole "+(hole+1));
      if(hole<17){setHole(hole+1);localStorage.setItem("dango-scoring-hole:"+mode+":"+round.id+":"+player,String(hole+1));}

    }catch(err){onNotice("Scores NOT saved: "+(err instanceof Error?err.message:String(err))+". Review and retry.");}
    finally{setSaving(false);}
  }
  if(!mine)return <p>You're not assigned to a foursome for this round.</p>;
  const jump=(n:number)=>{const next=Math.max(0,Math.min(17,n));setHole(next);localStorage.setItem("dango-scoring-hole:"+mode+":"+round.id+":"+player,String(next));};
  const scored=(e:typeof entries[number],i:number)=>state.scores[key(e.match,e.player,i)]?.gross;
  const scoredCount=Array.from({length:18},(_,i)=>entries.length>0&&entries.every(e=>scored(e,i)!=null)).filter(Boolean).length;
  const [nine,setNine]=useState(0);
  const teamFor=(e:typeof entries[number])=>state.players.find(p=>p.id===e.player)?.team??0;
  const sumRange=(e:typeof entries[number],start:number,end:number)=>{
    const scores=Array.from({length:end-start},(_,i)=>scored(e,start+i));
    return scores.every((n):n is number=>n!=null)?scores.reduce((a,b)=>a+b,0):null;
  };
  const totalPar=round.holes.reduce((v,h)=>v+h.par,0);
  const ninePar=round.holes.slice(nine*9,nine*9+9).reduce((v,h)=>v+h.par,0);
  return <div className="foursome-entry">
    <div className="foursome-heading"><div><div className="eyebrow">{round.name.toUpperCase()} · LIVE SCORING</div><h2>Hole {hole+1} <span className="scoring-par">· Par {round.holes[hole]?.par}</span></h2></div><span className="scoring-live-pill">● LIVE</span></div>
    <div className="scoring-nav"><button type="button" onClick={()=>jump(hole-1)} disabled={hole===0}>← Previous</button><span>{scoredCount} of 18 holes complete</span><button type="button" onClick={()=>jump(hole+1)} disabled={hole===17}>Next →</button></div>
    <div className="foursome-score-grid">
      {entries.map((e,i)=><div className={"foursome-player "+(teamFor(e)===0?"flag-usa":"flag-europe")} key={e.match+":"+e.player}>
        <div className="flag-player-title"><span className="team-flag" aria-label={teamFor(e)===0?"USA":"Europe"}>{teamFor(e)===0?"🇺🇸":"🇪🇺"}</span><strong>{e.label}</strong></div>
        <div className="foursome-stepper">
          <button type="button" aria-label={"Decrease score for "+e.label} onClick={()=>change(e,-1)}><Minus size={20}/></button>
          <strong>{scoreFor(e)}</strong>
          <button type="button" aria-label={"Increase score for "+e.label} onClick={()=>change(e,1)}><Plus size={20}/></button>
        </div>
      </div>)}
    </div>
    <button className="primary foursome-save" disabled={saving||!entries.length} onClick={async()=>{await saveAll();}}><Check size={19}/>{saving?"Saving scores…":hole===17?"Save All Scores · Finish":"Save All Scores & Next Hole"}</button>
    <p className="scoring-save-hint">All scores save together. Your next hole will be ready when you return.</p>
    <div className="scoring-card-toggle"><button type="button" onClick={()=>setShowCard(v=>!v)} aria-expanded={showCard}>{showCard?"▾ Hide Full Scorecard":"▸ View Full Scorecard"} <span>{scoredCount}/18 complete</span></button></div>
    {showCard&&<div className="scoring-card-detail">
      <div className="scoring-nine-switch"><button type="button" className={nine===0?"selected":""} onClick={()=>setNine(0)}>Front 9</button><button type="button" className={nine===1?"selected":""} onClick={()=>setNine(1)}>Back 9</button></div>
      <div className="table-scroll"><table className="scoring-scorecard"><thead><tr><th>Hole</th>{round.holes.slice(nine*9,nine*9+9).map((_,i)=><th key={i}><button type="button" className={hole===nine*9+i?"active-hole":""} onClick={()=>jump(nine*9+i)}>{nine*9+i+1}</button></th>)}<th>{nine===0?"OUT":"IN"}</th>{nine===1&&<th>TOTAL</th>}</tr><tr><th>Par</th>{round.holes.slice(nine*9,nine*9+9).map((h,i)=><th key={i}>{h.par}</th>)}<th>{ninePar}</th>{nine===1&&<th>{totalPar}</th>}</tr></thead><tbody>
      {entries.map(e=><tr key={e.match+e.player}><th><span className="scorecard-team-flag">{teamFor(e)===0?"🇺🇸":"🇪🇺"}</span> {e.label}</th>{round.holes.slice(nine*9,nine*9+9).map((_,i)=>{const n=scored(e,nine*9+i);const par=round.holes[nine*9+i].par;return <td key={i}><button type="button" className={n==null?"":n<par?"under-par":n>par?"over-par":"at-par"} onClick={()=>jump(nine*9+i)}>{n??"—"}</button></td>})}<td className="scoring-nine-total">{sumRange(e,nine*9,nine*9+9)??"—"}</td>{nine===1&&<td className="scoring-grand-total">{sumRange(e,0,18)??"—"}</td>}</tr>)}
      </tbody></table></div>
      <p className="muted">Tap a hole to review or correct scores. Green = under par; outlined = over par.</p>
    </div>}
  </div>;
}

function LiveSkinWinners({state}:{state:State}) {
  const [selectedRound,setSelectedRound]=useState<string|null>(null);
  useEffect(()=>{
    const saved=localStorage.getItem("dango-skins-selected-round");
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const current=state.rounds.find(item=>item.date===today);
    setSelectedRound(saved && state.rounds.some(item=>item.id===saved)?saved:current?.id??state.rounds[0]?.id??"r0");
  },[state.rounds]);
  const chooseRound=(id:string)=>{setSelectedRound(id);localStorage.setItem("dango-skins-selected-round",id);};
  const r=state.rounds.find(item=>item.id===selectedRound)??state.rounds[0];
  if (!r) return <section className="panel">No rounds configured.</section>;
  const holes=liveSkins(state,r);
  const complete=holes.filter(h=>h.status==="won"||h.status==="tied").length;
  const winners=holes.filter(h=>h.status==="won").length;
  return <div className="live-skins">
    <div className="round-picker" role="group" aria-label="Choose round">
      {state.rounds.map((item,i)=><button type="button" key={item.id} className={item.id===r.id?"selected":""} aria-pressed={item.id===r.id} onClick={()=>chooseRound(item.id)}>Round {i+1}<small>{item.name}</small></button>)}
    </div>
    <section className="panel">
      <div className="skin-header"><div><div className="eyebrow">LIVE SKIN WINNERS</div><h2>{r.name}</h2><p>{complete} of 18 holes complete · {winners} skins won</p></div><div className="skin-progress">{Math.round(complete/18*100)}%<small>REVEALED</small></div></div>
      <p>Winners stay hidden until all {r.format==="shamble"||r.format==="scramble"?"six teams":"12 golfers"} enter their scores for a hole. Tied low net means no skin.</p>
      <div className="skin-hole-list">
        {holes.map(h=><div key={h.hole} className={"skin-hole "+(h.status==="won"?"skin-hole-won":"")}>
          <div className="skin-hole-number"><small>HOLE</small><strong>{h.hole}</strong></div>
          <div className="skin-hole-result">
            {h.status==="won"?<strong className="skin-winner">{h.leaders.map(id=>state.players.find(p=>p.id===id)?.name??id).join(" / ")}<span>SKIN WINNER</span></strong>:h.status==="tied"?<strong>NO SKIN — TIED</strong>:<span className="muted">WAITING FOR SCORES</span>}
            <small>{h.entered} / {h.expected} scores entered{h.status==="won"?" · Net "+h.net:""}</small>
          </div>
        </div>)}
      </div>
    </section>
  </div>;
}

function MoneyCenter({state,admin,onSave}:{
  state:State; admin:boolean; onSave:(next:State,message:string)=>void;
}) {
  const settings=prizeSettings(state);
  const [draft,setDraft]=useState(settings);
  const [selectedRound,setSelectedRound]=useState(state.rounds[0]?.id??"r0");
  useEffect(()=>setDraft(prizeSettings(state)),[state]);
  const golfers=moneyLeaderboard(state);
  const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
  const save=()=>onSave({...state,prizes:draft},"Prize settings and payouts updated");
  return <div className="admin">
    <section className="panel">
      <h2>Money Center · Road to 9.5</h2>
      <p>$2,400 planned pool · $600 championship · $600 match wins · $1,200 net skins. Only actual earned payouts are counted below.</p>
      <div className="form-row">
        <label>Championship bonus per winning golfer
          <input type="number" min="0" step="1" value={draft.championshipPerWinner} disabled={!admin}
            onChange={e=>setDraft({...draft,championshipPerWinner:+e.target.value})}/>
        </label>
        <label>Match win per golfer
          <input type="number" min="0" step="1" value={draft.matchPerWinner} disabled={!admin}
            onChange={e=>setDraft({...draft,matchPerWinner:+e.target.value})}/>
        </label>
      </div>
      <p>Each 2-man match awards $20 per winning golfer; singles awards $20 per winner. Halved matches pay $10 to each golfer. No entry-fee or contribution tracking.</p>
      {admin && <button className="primary" onClick={save}>Save prize settings & payouts</button>}
    </section>
    <section className="panel">
      <h2>Daily net skins</h2>
      <p>100% course handicap · all 12 compete on individual days · team skins on Shamble and Scramble · no carryovers. All 18 holes and all scores must be complete before skins are awarded.</p>
      <div className="round-picker" role="group" aria-label="Choose payout round">{state.rounds.map((r,i)=><button type="button" key={r.id} className={selectedRound===r.id?"selected":""} aria-pressed={selectedRound===r.id} onClick={()=>setSelectedRound(r.id)}>Round {i+1}<small>{r.name}</small></button>)}</div>
      {state.rounds.filter(r=>r.id===selectedRound).map(r=>{
        const sk=roundSkins(state,r);
        return <div key={r.id} style={{marginBottom:24}}>
          <h3>{r.name} · {r.tee || (r.id==="r2"||r.id==="r3"?"BLUE":"WHITE")} tees</h3>
          <div className="form-row">
            <label>Daily skins pot
              <input type="number" min="0" step="1" disabled={!admin}
                value={draft.dailySkins[r.id]??240}
                onChange={e=>setDraft({...draft,dailySkins:{...draft.dailySkins,[r.id]:+e.target.value}})}/>
            </label>
          </div>
          <p>{sk.mode==="team"?"2-man team net skins (split 50/50)":"Individual net skins among all 12"} · {sk.complete? `${sk.skins.length} winning skins · ${money(sk.skinValue)} per skin`:"Pending complete verified 18-hole scorecards"}</p>
          {sk.complete && sk.skins.length===0 && <p>No skins won. {money(sk.pot)} remains unawarded for administrator decision.</p>}
          {sk.complete && sk.skins.length>0 && <div className="table-scroll"><table><thead><tr><th>Hole</th><th>Winner</th><th>Net</th><th>Prize</th></tr></thead><tbody>
            {sk.skins.map(skin=><tr key={skin.hole}><td>{skin.hole}</td><td>{skin.winners.map(id=>state.players.find(p=>p.id===id)?.name??id).join(" / ")}</td><td>{skin.net}</td><td>{money(skin.amount)}</td></tr>)}
          </tbody></table></div>}
        </div>;
      })}
    </section>
    <section className="panel">
      <h2>Golfer earnings & payment tracking</h2>
      <p>Only winnings are tracked. Enter cumulative amounts paid out to each golfer; the remaining balance updates automatically.</p>
      <div className="table-scroll"><table><thead><tr><th>Golfer</th><th>Matches</th><th>Skins</th><th>Championship</th><th>Total earned</th><th>Paid</th><th>Owed</th></tr></thead><tbody>
        {golfers.map(g=><tr key={g.player}>
          <td>{state.players.find(p=>p.id===g.player)?.name??g.player}</td>
          <td>{money(g.matches)}</td><td>{money(g.skins)}</td><td>{money(g.championship)}</td><td><b>{money(g.total)}</b></td>
          <td>{admin?<input aria-label={`Paid to ${g.player}`} type="number" min="0" step=".01" value={draft.paid[g.player]??0} onChange={e=>setDraft({...draft,paid:{...draft.paid,[g.player]:+e.target.value}})}/>:money(g.paid)}</td>
          <td>{money(g.total-(draft.paid[g.player]??0))}</td>
        </tr>)}
      </tbody></table></div>
      {admin && <button className="primary" onClick={save}>Save paid amounts</button>}
    </section>
  </div>;
}

function CourseScorecard({ course }: { course: State["rounds"][number] }) {
  if (course.holes.length !== 18) return <p>Full 18-hole scorecard not loaded yet.</p>;
  const sum = (holes: typeof course.holes, field: "par" | "yards") =>
    holes.reduce((total, h) => total + h[field], 0);
  return (
    <div className="course-scorecard" style={{ marginTop: 16 }}>
      <p><strong>{course.tee || "Tee not selected"} tees</strong> · Rating {course.rating.toFixed(1)} / Slope {course.slope} · Par {sum(course.holes, "par")} · {sum(course.holes, "yards").toLocaleString()} yards</p>
      {!course.verified && <p><strong>Pending verification:</strong> Confirm this course's scorecard before tournament play.</p>}
      <div className="table-scroll" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 680, width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
          <thead><tr><th scope="col">Hole</th>{course.holes.slice(0, 9).map((_, i) => <th key={i} scope="col">{i + 1}</th>)}<th scope="col">OUT</th></tr></thead>
          <tbody>
            <tr><th scope="row">Yards</th>{course.holes.slice(0, 9).map((h, i) => <td key={i}>{h.yards}</td>)}<td><strong>{sum(course.holes.slice(0, 9), "yards")}</strong></td></tr>
            <tr><th scope="row">Par</th>{course.holes.slice(0, 9).map((h, i) => <td key={i}>{h.par}</td>)}<td><strong>{sum(course.holes.slice(0, 9), "par")}</strong></td></tr>
            <tr><th scope="row">HCP</th>{course.holes.slice(0, 9).map((h, i) => <td key={i}>{h.rank}</td>)}<td>—</td></tr>
          </tbody>
        </table>
      </div>
      <div className="table-scroll" style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ minWidth: 680, width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
          <thead><tr><th scope="col">Hole</th>{course.holes.slice(9).map((_, i) => <th key={i} scope="col">{i + 10}</th>)}<th scope="col">IN</th><th scope="col">TOTAL</th></tr></thead>
          <tbody>
            <tr><th scope="row">Yards</th>{course.holes.slice(9).map((h, i) => <td key={i}>{h.yards}</td>)}<td><strong>{sum(course.holes.slice(9), "yards")}</strong></td><td><strong>{sum(course.holes, "yards")}</strong></td></tr>
            <tr><th scope="row">Par</th>{course.holes.slice(9).map((h, i) => <td key={i}>{h.par}</td>)}<td><strong>{sum(course.holes.slice(9), "par")}</strong></td><td><strong>{sum(course.holes, "par")}</strong></td></tr>
            <tr><th scope="row">HCP</th>{course.holes.slice(9).map((h, i) => <td key={i}>{h.rank}</td>)}<td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
