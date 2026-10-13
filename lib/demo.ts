import { State, Round, Match, key } from "./scoring";
export function demo(): State {
  const players = [
    "James Wilson",
    "Michael Brooks",
    "David Chen",
    "Ryan Mitchell",
    "Thomas Reed",
    "Alex Parker",
    "William Hayes",
    "Daniel Morgan",
    "Chris Bennett",
    "Matt Sullivan",
    "Andrew Cole",
    "Jack Turner",
  ].map((name, i) => ({
    id: `p${i}`,
    name,
    index: 6 + i * 1.3,
    team: (i < 6 ? 0 : 1) as 0 | 1,
    captain: i === 0 || i === 6,
    avatar: "",
    overrides: {},
  }));
  const names = [
    "Oyster Bay",
    "Heritage Club",
    "Legends Heathland",
    "Legends Moorland",
    "Legends Parkland",
  ];
  const times = [
    ["09:16", "09:24", "09:32"],
    ["09:40", "09:48", "09:56"],
    ["08:04", "08:12", "08:20"],
    ["13:34", "13:42", "13:50"],
    ["09:16", "09:24", "09:32"],
  ];
  const rounds: Round[] = names.map((name, i) => ({
    id: `r${i}`,
    name,
    format: (
      ["bestball", "stableford", "shamble", "scramble", "singles"] as const
    )[i],
    times: times[i],
    date: "",
    rating: 72,
    slope: 113,
    tee: i === 2 || i === 3 ? "Blue (demo only)" : "White (demo only)",
    verified: false,
    holes: Array.from({ length: 18 }, (_, j) => ({
      par: [4, 4, 3, 5, 4, 4, 3, 5, 4][j % 9],
      rank: j + 1,
      yards: 350,
    })),
    shamble: "best",
    locked: true,
  }));
  const matches: Match[] = rounds.flatMap((r, i) =>
    Array.from({ length: i === 4 ? 6 : 3 }, (_, j) => ({
      id: `m${i}-${j}`,
      round: r.id,
      a: i === 4 ? [`p${j}`] : [`p${j * 2}`, `p${j * 2 + 1}`],
      b: i === 4 ? [`p${j + 6}`] : [`p${j * 2 + 6}`, `p${j * 2 + 7}`],
      position: j,
      slot: i === 4 ? Math.floor(j / 2) : j,
      approved: true,
    })),
  );
  const scores: State["scores"] = {};
  matches
    .filter((m) => m.round === "r0")
    .forEach((m, j) => {
      for (let hole = 0; hole < (j === 0 ? 18 : 7 + j * 2); hole++)
        for (const [i, id] of [...m.a, ...m.b].entries())
          scores[key(m.id, id, hole)] = {
            gross:
              rounds[0].holes[hole].par +
              ((hole + i + j) % 3 === 0 ? 1 : 0) +
              (j === 0 && i > 1 ? 2 : 0),
            version: 1,
          };
    });
  return {
    players,
    rounds,
    matches,
    scores,
    teams: [
      { name: "Palmetto", color: "#d5b56a" },
      { name: "Atlantic", color: "#7fb4e0" },
    ],
    audit: [],
  };
}
export function blank(): State {
  const s = demo();
  return {
    ...s,
    players: [],
    matches: [],
    scores: {},
    audit: [],
    rounds: s.rounds.map((r) => ({
      ...r,
      locked: false,
      verified: false,
      holes: [],
      rating: 0,
      slope: 0,
      tee: "",
    })),
  };
}
