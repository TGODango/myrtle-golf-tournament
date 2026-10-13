# Road to 9.5 — scoring and money release checklist

## Confirmed format and tees
| Round | Course | Tees | Format | Skins |
|---|---|---|---|---|
| 1 | Oyster Bay | WHITE | 2-man best ball | Individual net, all 12 |
| 2 | Heritage Club | WHITE | 2-man combined **standard** Stableford | Individual net, all 12 |
| 3 | Legends Heathland | BLUE | 2-man shamble, best net ball | 2-man team net |
| 4 | Legends Moorland | BLUE | 2-man scramble, 35% lower + 15% higher course handicap | 2-man team net |
| 5 | Legends Parkland | WHITE | Singles net match play | Individual net, all 12 |

All 18 holes must be scored for every eligible player or pair before daily skins finalize. No carryovers. Ties for lowest net on a hole produce no skin. Skins payout is divided equally among skins won; team skins are split equally between partners. Zero winning skins leaves the daily pot unawarded for an admin decision.

## Prize settings
- Total planned pool: $2,400, **not** a player-contribution ledger.
- Championship: $100 each to the six winning golfers ($600).
- Match payouts: $20 per golfer on a winning side; tied matches split the match pot equally ($600 planned).
- Daily net skins: $240 per day ($1,200 planned).
- Admin can change payout amounts and record cumulative amounts paid to each golfer. The dashboard tracks winnings only.

## Live rollout: critical steps
1. **Apply** `supabase/migrations/002_scramble_prizes.sql` in the existing Supabase project *before* merging/deploying this branch. This updates RPCs but does not overwrite tournament data.
2. **Back up** the current `tournaments.state` JSON before changing live round configuration.
3. In Admin, set rounds 1, 2, and 5 to **White** and rounds 3 and 4 to **Blue**; set round 4's format to **Scramble**.
4. **Import actual official tee-specific hole-by-hole scorecards**, including par, stroke index, yardage, course rating, and slope, and explicitly mark them verified. No unverified course data was invented or silently applied.
5. Review and approve all six golfer pairings per side and confirm all round dates.
6. Check results against a paper scorecard, including a tied match, a tied skin, a team skin, Stableford scoring, and an early-decided match whose skins remain pending.
7. Merge and deploy only after confirming the existing player logins, roster, match drafts, and scores remain intact.

**Note:** The live tournament state is intentionally not changed by this code branch. Existing values and live scores are preserved until an admin updates them.
