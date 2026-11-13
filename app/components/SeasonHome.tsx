"use client";
type Props = { onArchive: () => void; onTrip: () => void; onPhotos: () => void };
export default function SeasonHome({ onArchive, onTrip, onPhotos }: Props) {
  return <div className="season-home">
    <div className="season-heading"><span className="season-kicker">DANGO GOLF · MYRTLE BEACH</span><span className="season-year">EST. 2026</span></div>
    <section className="champions-hero">
      <img src="/2026-myrtle-champions.webp" alt="Team America, the six 2026 Myrtle Beach champions, posing together at Legends Golf Resort" width="1448" height="1086" fetchPriority="high" />
      <div className="champions-caption"><div><span className="season-kicker">THE 2026 CHAMPIONS</span><h1>The cup stays with America.</h1></div><div className="season-final"><span>🇺🇸 AMERICA <b>9.5</b></span><i>/</i><span>🇪🇺 EUROPE <b>8.5</b></span></div></div>
    </section>
    <section className="next-season">
      <div className="next-season-year" aria-hidden="true">2027</div>
      <div className="next-season-copy"><span className="season-kicker">NEXT CHAPTER · COMING SOON</span><h2>The rematch is coming.</h2><p>New trip. Same rivalry. The 2027 Myrtle Beach trip is on the horizon—watch here for announcements.</p><div className="season-actions"><button className="primary" onClick={onTrip}>2027 trip updates ↗</button><button onClick={onPhotos}>2026 trip photos ↗</button><button onClick={onArchive}>Relive the 2026 championship →</button></div></div>
    </section>
    <section className="season-announcements"><div><span className="season-kicker">THE CLUBHOUSE</span><h2>Trip announcements</h2></div><article><span className="announcement-tag">2027 · COMING SOON</span><h3>Save the excitement. Dates come next.</h3><p>Dates, courses, lodging and the lineup will be announced here once plans are confirmed.</p><button onClick={onTrip}>See what's next →</button></article><article><span className="announcement-tag announcement-complete">2026 · IN THE BOOKS</span><h3>America wins. The memories stay.</h3><p>Five rounds, eighteen matches and a 9.5–8.5 finish. Explore the final results, scorecards, skins and payouts.</p><button onClick={onArchive}>Open the 2026 archive →</button></article></section>
  </div>;
}
export function Trip2027({ onArchive }: { onArchive: () => void }) {
  return <div className="season-home"><section className="next-season trip-coming-soon"><div className="next-season-year" aria-hidden="true">2027</div><div className="next-season-copy"><span className="season-kicker">DANGO GOLF · MYRTLE BEACH</span><h1>The rematch is coming.</h1><p>Team America has the cup. Europe has a score to settle.</p><span className="announcement-tag">TRIP DETAILS COMING SOON</span></div></section><section className="trip-detail-grid">{[["Dates", "To be announced"],["Courses", "To be announced"],["Lodging", "To be announced"],["Who's playing", "Lineup coming soon"]].map(([title,detail])=><article className="panel" key={title}><span className="season-kicker">{title}</span><h2>{detail}</h2></article>)}</section><section className="panel"><h2>Watch this space.</h2><p>Confirmed plans and announcements will appear here as the 2027 trip takes shape.</p><button onClick={onArchive}>View the 2026 championship →</button></section></div>;
}
