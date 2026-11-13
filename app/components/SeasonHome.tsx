"use client";
export default function SeasonHome() {
  return <div className="season-home">
    <section className="champions-hero">
      <img src="/2026-myrtle-champions.webp" alt="The group together at Legends Golf Resort during the 2026 Myrtle Beach golf trip" width="1448" height="1086" fetchPriority="high" />
    </section>
    <section className="next-season">
      <div className="next-season-year" aria-hidden="true">2027</div>
      <div className="next-season-copy"><h1>Where and when will the 2027 golf trip be?</h1><p>Stay tuned.</p></div>
    </section>
  </div>;
}
export function Trip2027() {
  return <div className="season-home"><section className="next-season trip-coming-soon"><div className="next-season-year" aria-hidden="true">2027</div><div className="next-season-copy"><h1>Where and when will the 2027 golf trip be?</h1><p>Stay tuned.</p></div></section></div>;
}
