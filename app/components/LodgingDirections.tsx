"use client";
import { useState } from "react";
import type { State } from "../../lib/scoring";

const houses = [
  { name: "Girvan House 4578", address: "4578 Girvan Drive, Myrtle Beach, SC 29579", bedrooms: 2, golfers: ["Fleming", "Dustin"] },
  { name: "Montrose House H", address: "4425 Montrose Ln #4425-H, Myrtle Beach, SC 29579", bedrooms: 3, golfers: ["Andy", "Digger", "Joe"] },
  { name: "Arran House 8C", address: "4612 Arran Ct, Unit 8C, Myrtle Beach, SC 29579", bedrooms: 3, golfers: ["Fisher", "Joyce", "Moose"] },
  { name: "Girvan House 4499", address: "4499 Girvan Dr, Myrtle Beach, SC 29579", bedrooms: 2, golfers: ["Seth", "Weav"] },
  { name: "Montrose House C", address: "4433 Montrose Ln, Unit C, Myrtle Beach, SC 29579", bedrooms: 2, golfers: ["Trav", "Sacco"] },
];

const courseDestinations: Record<string, string> = {
  "oyster": "Oyster Bay Golf Links, Sunset Beach, NC",
  "heritage": "Heritage Club Golf Course, Pawleys Island, SC",
  "heathland": "Legends Golf Resort Heathland Course, Myrtle Beach, SC",
  "moorland": "Legends Golf Resort Moorland Course, Myrtle Beach, SC",
  "parkland": "Legends Golf Resort Parkland Course, Myrtle Beach, SC",
};

function mapsDirections(destination: string, travelmode: "walking" | "driving", origin?: string) {
  const params = new URLSearchParams({ api: "1", destination, travelmode });
  if (origin) params.set("origin", origin);
  return "https://www.google.com/maps/dir/?" + params.toString();
}

function MapsLinks({ destination, origin }: { destination: string; origin?: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
      <a className="primary" style={{ display: "inline-block", padding: "10px 14px", borderRadius: 8, textDecoration: "none" }}
        href={mapsDirections(destination, "walking", origin)} target="_blank" rel="noopener noreferrer">
        🚶 Walking directions ↗
      </a>
      <a style={{ display: "inline-block", padding: "10px 14px", border: "1px solid currentColor", borderRadius: 8, textDecoration: "none" }}
        href={mapsDirections(destination, "driving", origin)} target="_blank" rel="noopener noreferrer">
        🚗 Driving directions ↗
      </a>
    </div>
  );
}

export default function LodgingDirections({ rounds }: { rounds: State["rounds"] }) {
  const [origin, setOrigin] = useState("current");
  const originAddress = origin === "current" ? undefined : houses.find(h => h.name === origin)?.address;
  return (
    <div className="schedule">
      <section className="panel">
        <div className="eyebrow">MYRTLE BEACH · TRIP GUIDE</div>
        <h1>🏠 Lodging & Directions</h1>
        <p>Find your crew, pick a destination, and open Google Maps. No house entry codes are shown here.</p>
        <label style={{ display: "block", marginTop: 14 }}>
          <strong>Directions starting from</strong>
          <select value={origin} onChange={e => setOrigin(e.target.value)} style={{ display: "block", marginTop: 8, maxWidth: "100%", padding: 10 }}>
            <option value="current">📍 My current location</option>
            {houses.map(h => <option key={h.name} value={h.name}>{h.name} — {h.golfers.join(", ")}</option>)}
          </select>
        </label>
        <p style={{ fontSize: 13, opacity: .8, marginTop: 10 }}>Walking routes depend on Google Maps availability. Oyster Bay and Heritage are off-resort courses; driving is recommended.</p>
      </section>
      <section className="panel">
        <h2>Where everyone is staying</h2>
        <p>Tap a house to navigate directly to its address.</p>
      </section>
      {houses.map(h => (
        <section className="panel" key={h.name}>
          <div className="eyebrow">{h.bedrooms} BEDROOMS</div>
          <h2>{h.name}</h2>
          <p><strong>👥 {h.golfers.join(" · ")}</strong></p>
          <p>{h.address}</p>
          <MapsLinks destination={h.address} origin={originAddress} />
        </section>
      ))}
      <section className="panel">
        <h2>⛳ Golf course directions</h2>
        <p>Navigate to any of the five tournament rounds.</p>
      </section>
      {rounds.map((round, i) => {
        const lower = round.name.toLowerCase();
        const destination = Object.entries(courseDestinations).find(([term]) => lower.includes(term))?.[1]
          ?? round.name + " golf course, Myrtle Beach, SC";
        return (
          <section className="panel" key={round.id}>
            <div className="eyebrow">ROUND {i + 1}{round.date ? " · " + round.date : ""}</div>
            <h2>{round.name}</h2>
            <p>{destination}</p>
            <MapsLinks destination={destination} origin={originAddress} />
          </section>
        );
      })}
    </div>
  );
}
