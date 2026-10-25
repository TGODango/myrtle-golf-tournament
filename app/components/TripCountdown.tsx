"use client";
import { useEffect, useState } from "react";

// November 9, 2026, 9:16 AM in Myrtle Beach (Eastern Standard Time).
const FIRST_TEE_TIME = Date.parse("2026-11-09T09:16:00-05:00");

function remaining(now: number) {
  const seconds = Math.max(0, Math.floor((FIRST_TEE_TIME - now) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    started: now >= FIRST_TEE_TIME,
  };
}

export default function TripCountdown({ compact = false }: { compact?: boolean }) {
  // Keep the initial server and client render consistent; start ticking after mount.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = remaining(now ?? FIRST_TEE_TIME - 86400);
  if (compact) {
    return (
      <div aria-label="Countdown to Myrtle Beach golf" style={{fontWeight:800,fontSize:12,textAlign:"center",lineHeight:1.3,whiteSpace:"nowrap"}}>
        <div style={{fontSize:10,letterSpacing:1,opacity:.75}}>⛳ MYRTLE COUNTDOWN</div>
        <span>{now === null ? "Loading…" : time.started ? "IT'S TEE TIME! 🏌️" : `${time.days}d ${String(time.hours).padStart(2,"0")}h ${String(time.minutes).padStart(2,"0")}m ${String(time.seconds).padStart(2,"0")}s`}</span>
      </div>
    );
  }
  return (
    <section className="panel" style={{textAlign:"center",marginBottom:20}}>
      <div className="eyebrow">⛳ ROAD TO MYRTLE BEACH</div>
      <h2 style={{marginTop:8}}>Countdown to the First Tee</h2>
      <p>Oyster Bay · Monday, November 9, 2026 · 9:16 AM ET</p>
      {time.started ? <h2 style={{marginTop:20}}>🏆 IT'S TEE TIME!</h2> : (
        <div aria-live="off" style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginTop:20}}>
          {([["DAYS",time.days],["HOURS",time.hours],["MINUTES",time.minutes],["SECONDS",time.seconds]] as const).map(([label,value]) => (
            <div key={label} style={{minWidth:65,padding:"12px 8px",border:"1px solid #d5b56a",borderRadius:12}}>
              <div style={{fontSize:"clamp(22px,5vw,38px)",fontWeight:900,fontVariantNumeric:"tabular-nums"}}>{now === null ? "—" : String(value).padStart(2,"0")}</div>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1}}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
