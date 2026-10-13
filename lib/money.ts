import { State, Match, Round, handicap, key, result, strokes } from "./scoring";

export type PrizeSettings = {
  championshipPerWinner: number;
  matchPerWinner: number;
  dailySkins: Record<string, number>;
  paid: Record<string, number>;
  unawarded: Record<string, number>;
};
export const defaultPrizes = (s: State): PrizeSettings => ({
  championshipPerWinner: 100,
  matchPerWinner: 20,
  dailySkins: Object.fromEntries(s.rounds.map(r => [r.id, 240])),
  paid: {},
  unawarded: {},
});
export function prizeSettings(s: State): PrizeSettings {
  const defaults = defaultPrizes(s);
  const saved = s.prizes;
  return {
    ...defaults, ...saved,
    dailySkins: { ...defaults.dailySkins, ...saved?.dailySkins },
    paid: { ...saved?.paid },
    unawarded: { ...saved?.unawarded },
  };
}
export type Skin = { hole: number; winners: string[]; net: number; amount: number };
export type RoundSkins = {
  round: string; complete: boolean; mode: "individual" | "team";
  skins: Skin[]; pot: number; skinValue: number; unawarded: number;
};
function matchEntries(s: State, r: Round) {
  return s.matches.filter(m => m.round === r.id && m.approved);
}
function score(s: State, m: Match, ids: string[], hole: number, r: Round): number | null {
  if (r.format === "scramble") {
    // The first golfer of a pair is the designated team-score record.
    const entry = s.scores[key(m.id, ids[0], hole)];
    if (!entry) return null;
    const ch = ids.map(id => handicap(s.players.find(p => p.id === id)!, r)).sort((a,b)=>a-b);
    const teamCH = Math.round(0.35 * ch[0] + 0.15 * ch[1]);
    return entry.gross - strokes(teamCH, r.holes[hole].rank);
  }
  const nets = ids.map(id => {
    const entry = s.scores[key(m.id, id, hole)];
    if (!entry) return null;
    const p = s.players.find(p => p.id === id);
    return p ? entry.gross - strokes(handicap(p, r), r.holes[hole].rank) : null;
  });
  if (nets.some(v => v === null)) return null;
  return Math.min(...(nets as number[]));
}
export function roundSkins(s: State, r: Round): RoundSkins {
  const pot = Math.max(0, prizeSettings(s).dailySkins[r.id] ?? 240);
  const mode = r.format === "shamble" || r.format === "scramble" ? "team" : "individual";
  const matches = matchEntries(s, r);
  const expected = r.format === "singles" ? 6 : 3;
  const completePairings = matches.length === expected &&
    matches.every(m => m.a.length === (r.format === "singles" ? 1 : 2) &&
      m.b.length === (r.format === "singles" ? 1 : 2));
  const complete = r.verified && r.holes.length === 18 && completePairings &&
    matches.every(m => Array.from({length:18},(_,hole) =>
      (mode === "team"
        ? [m.a,m.b].every(ids => score(s,m,ids,hole,r)!==null)
        : [...m.a,...m.b].every(id => score(s,m,[id],hole,r)!==null)
      )).every(Boolean));
  if (!complete) return {round:r.id,complete:false,mode,skins:[],pot,skinValue:0,unawarded:pot};
  const skins: Skin[] = [];
  for (let hole=0;hole<18;hole++) {
    const contenders = matches.flatMap(m => mode === "team"
      ? [m.a,m.b].map(ids => ({ids,net:score(s,m,ids,hole,r)!}))
      : [...m.a,...m.b].map(id => ({ids:[id],net:score(s,m,[id],hole,r)!})));
    const best = Math.min(...contenders.map(c=>c.net));
    const winners = contenders.filter(c=>c.net===best);
    if (winners.length===1) skins.push({hole:hole+1,winners:winners[0].ids,net:best,amount:0});
  }
  const skinValue = skins.length ? pot / skins.length : 0;
  return {round:r.id,complete:true,mode,
    skins:skins.map(x=>({...x,amount:skinValue})),pot,skinValue,
    unawarded:skins.length ? 0 : pot};
}
export type GolferMoney = { player: string; matches: number; skins: number; championship: number; total: number; paid: number; balance: number };
export function moneyLeaderboard(s: State): GolferMoney[] {
  const settings = prizeSettings(s);
  const earnings = Object.fromEntries(s.players.map(p=>[p.id,{matches:0,skins:0,championship:0}]));
  for(const m of s.matches) {
    const x = result(s,m);
    if(!x.complete || !m.approved) continue;
    const sides = [m.a,m.b];
    for(let side=0;side<2;side++) {
      const share = x.points[side];
      for(const id of sides[side]) if(earnings[id])
        earnings[id].matches += settings.matchPerWinner * share;
    }
  }
  for(const r of s.rounds) {
    const skins = roundSkins(s,r);
    if(!skins.complete) continue;
    for(const skin of skins.skins)
      for(const id of skin.winners)
        if(earnings[id]) earnings[id].skins += skin.amount/skin.winners.length;
  }
  const st = s.matches.length === 18 ? s.matches.filter(m=>result(s,m).complete).length : 0;
  if(st===18) {
    const wins = s.matches.reduce((a,m)=>{
      const p = result(s,m).points;
      return [a[0]+p[0],a[1]+p[1]];
    },[0,0]);
    const champion = wins[0]>=9.5?0:wins[1]>=9.5?1:null;
    if(champion!==null) for(const p of s.players)
      if(p.team===champion) earnings[p.id].championship += settings.championshipPerWinner;
  }
  return s.players.map(p=>{
    const e=earnings[p.id],paid=settings.paid[p.id]??0;
    const total=e.matches+e.skins+e.championship;
    return {player:p.id,...e,total,paid,balance:total-paid};
  }).sort((a,b)=>b.total-a.total);
}

export type LiveSkinHole = {
  hole: number; status: "waiting" | "provisional" | "tied" | "won";
  leaders: string[]; net: number | null; entered: number; expected: number;
};
/** Provisional leaders across the full field; never treats incomplete holes as paid skins. */
export function liveSkins(s: State, r: Round): LiveSkinHole[] {
  const mode = r.format === "shamble" || r.format === "scramble" ? "team" : "individual";
  const matches = matchEntries(s, r);
  const expected = mode === "team" ? 6 : 12;
  return Array.from({length:18},(_,i)=>{
    const contenders = matches.flatMap(m => (mode === "team"
      ? [m.a,m.b]
      : [...m.a,...m.b].map(id=>[id]))
      .map(ids=>({ids,net: r.holes.length===18 ? score(s,m,ids,i,r) : null})));
    const submitted = contenders.filter((x):x is {ids:string[];net:number}=>x.net!==null);
    if (!submitted.length) return {hole:i+1,status:"waiting" as const,leaders:[],net:null,entered:0,expected};
    const best=Math.min(...submitted.map(x=>x.net));
    const winners=submitted.filter(x=>x.net===best);
    const finished=r.holes.length===18 && matches.length===(r.format==="singles"?6:3) && submitted.length===expected;
    return {
      hole:i+1,
      status: finished ? (winners.length===1?"won" as const:"tied" as const) : "provisional" as const,
      leaders:winners.flatMap(x=>x.ids),net:best,entered:submitted.length,expected,
    };
  });
}
