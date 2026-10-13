export type Format = "bestball" | "stableford" | "shamble" | "scramble" | "singles";
export type Hole = { par: number; rank: number; yards: number };
export type Player = {
  id: string;
  name: string;
  index: number;
  team: 0 | 1;
  captain: boolean;
  avatar: string;
  overrides: Record<string, number>;
};
export type Round = {
  id: string;
  name: string;
  format: Format;
  times: string[];
  date: string;
  rating: number;
  slope: number;
  tee: string;
  verified: boolean;
  holes: Hole[];
  shamble: "best" | "combined";
  locked: boolean;
  nomination?: 0 | 1;
};
export type Match = {
  id: string;
  round: string;
  a: string[];
  b: string[];
  slot: number;
  position?: number;
  approved: boolean;
  nomination?: 0 | 1;
  manual?: 0 | 0.5 | 1;
  reopened?: boolean;
};
export type Score = { gross: number; version: number };
export type State = {
  players: Player[];
  rounds: Round[];
  matches: Match[];
  scores: Record<string, Score>;
  teams: { name: string; color: string }[];
  audit: { at: string; message: string }[];
  prizes?: { championshipPerWinner: number; matchPerWinner: number; dailySkins: Record<string, number>; paid: Record<string, number>; unawarded?: Record<string, number> };
};
export const key = (match: string, player: string, hole: number) =>
  `${match}:${player}:${hole}`;
export const courseHandicap = (
  index: number,
  slope: number,
  rating: number,
  par: number,
) => Math.floor((index * slope) / 113 + rating - par + 0.5);
export function strokes(handicap: number, rank: number) {
  return (
    Math.floor(handicap / 18) + (rank <= ((handicap % 18) + 18) % 18 ? 1 : 0)
  );
}
export const stableford = (gross: number, par: number, allocated: number) =>
  Math.min(5, Math.max(0, 2 + par - (gross - allocated)));
export function handicap(p: Player, r: Round) {
  return (
    p.overrides[r.id] ??
    courseHandicap(
      p.index,
      r.slope,
      r.rating,
      r.holes.reduce((s, h) => s + h.par, 0),
    )
  );
}
export function result(s: State, m: Match) {
  const r = s.rounds.find((r) => r.id === m.round)!;
  if (
    !r ||
    r.holes.length !== 18 ||
    !m.a.length ||
    !m.b.length ||
    [...m.a, ...m.b].some((id) => !s.players.some((p) => p.id === id))
  )
    return {
      played: 0,
      lead: 0,
      complete: false,
      points: [0, 0],
      status: "Awaiting pairings / scorecard",
      totals: [0, 0],
      individual: {} as Record<string, number>,
      winner: 0,
    };
  const ids = [...m.a, ...m.b];
  const h = Object.fromEntries(
    ids.map((id) => [
      id,
      handicap(
        s.players.find((p) => p.id === id)!,
        r,
      ),
    ]),
  );
  const low = Math.min(...Object.values(h));
  const scrambleHandicap = (ids: string[]) => { const ch = ids.map(id => h[id]).sort((a,b)=>a-b); return Math.round(0.35 * ch[0] + 0.15 * ch[1]); };
  let lead = 0,
    played = 0,
    totals = [0, 0],
    individual: Record<string, number> = {};
  let decided = false;
  let final = "";
  for (let n = 0; n < 18; n++) {
    if (r.format === "scramble" ? ![m.a[0],m.b[0]].every(id => s.scores[key(m.id,id,n)]) : !ids.every(id => s.scores[key(m.id,id,n)])) break;
    if (r.format === "scramble") {
      const a = s.scores[key(m.id,m.a[0],n)].gross - strokes(scrambleHandicap(m.a),r.holes[n].rank);
      const b = s.scores[key(m.id,m.b[0],n)].gross - strokes(scrambleHandicap(m.b),r.holes[n].rank);
      totals[0]+=a;totals[1]+=b;played++;lead+=Math.sign(b-a);
      if (Math.abs(lead)>18-played) {decided=true;final=played===18?`${Math.abs(lead)} UP final`:`${Math.abs(lead)} & ${18-played}`;break;}
      continue;
    }
    const values = ids.map((id) => {
      const gross = s.scores[key(m.id, id, n)].gross;
      const pts = stableford(
        gross,
        r.holes[n].par,
        strokes(h[id], r.holes[n].rank),
      );
      individual[id] = (individual[id] ?? 0) + pts;
      return r.format === "stableford"
        ? pts
        : gross - strokes(h[id] - low, r.holes[n].rank);
    });
    const aggregate = (v: number[]) =>
      r.format === "stableford" ||
      (r.format === "shamble" && r.shamble === "combined")
        ? v.reduce((a, b) => a + b, 0)
        : Math.min(...v);
    const a = aggregate(values.slice(0, m.a.length)),
      b = aggregate(values.slice(m.a.length));
    totals[0] += a;
    totals[1] += b;
    played++;
    lead += r.format === "stableford" ? 0 : Math.sign(b - a);
    if (r.format !== "stableford" && Math.abs(lead) > 18 - played) {
      decided = true;
      final =
        played === 18
          ? `${Math.abs(lead)} UP final`
          : `${Math.abs(lead)} & ${18 - played}`;
      break;
    }
  }
  if (r.format === "stableford") lead = totals[0] - totals[1];
  const complete =
    (decided || played === 18 || m.manual != null) && !m.reopened;
  const winner =
    m.manual != null
      ? m.manual === 0.5
        ? 0
        : m.manual === 1
          ? 1
          : -1
      : Math.sign(lead);
  const points = complete
    ? winner === 0
      ? [0.5, 0.5]
      : winner > 0
        ? [1, 0]
        : [0, 1]
    : [0, 0];
  const status =
    m.manual != null && !m.reopened
      ? m.manual === 0.5
        ? "Halved · adjudicated"
        : `${s.teams[m.manual === 1 ? 0 : 1].name} wins · adjudicated`
      : r.format === "stableford"
        ? `${totals[0]} – ${totals[1]} pts`
        : final ||
          (played === 18 && lead === 0
            ? "Halved"
            : lead === 0
              ? "All Square"
              : `${s.teams[lead > 0 ? 0 : 1].name} ${Math.abs(lead)} UP`);
  return { played, lead, complete, points, status, totals, individual, winner };
}
export function standings(s: State) {
  let official = [0, 0],
    projected = [0, 0],
    complete = 0;
  for (const m of s.matches) {
    const x = result(s, m);
    official = official.map((v, i) => v + x.points[i]);
    if (x.complete) complete++;
    const p = x.complete
      ? x.points
      : x.played
        ? x.lead === 0
          ? [0.5, 0.5]
          : x.lead > 0
            ? [1, 0]
            : [0, 1]
        : [0, 0];
    projected = projected.map((v, i) => v + p[i]);
  }
  return {
    official,
    projected,
    remaining: 18 - complete,
    complete,
    winner:
      official[0] >= 9.5
        ? s.teams[0].name
        : official[1] >= 9.5
          ? s.teams[1].name
          : complete === 18
            ? "Tournament tied 9–9"
            : null,
  };
}
