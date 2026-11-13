"use client";
import { useRef, useState } from "react";
import { tripPhotos } from "../../lib/trip-photos";

export default function TripPhotos() {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = tripPhotos[selected];
  function move(direction: number) {
    setSelected(index => (index + direction + tripPhotos.length) % tripPhotos.length);
  }
  return <section className="trip-photos">
    <div className="panel"><span className="season-kicker">2026 · MYRTLE BEACH</span><h2>The trip in pictures.</h2><p>On the course, at the clubhouse and everything in between. Tap a photo to see the full picture.</p><span>{tripPhotos.length} photos · November 2026</span></div>
    <div className="trip-photo-grid">{tripPhotos.map((item, index) => <button className="trip-photo-tile" key={item.src} aria-label={`Enlarge photo ${index + 1}`} onClick={() => { setSelected(index); dialog.current?.showModal(); }}><img src={item.thumbnail} alt={item.alt} width={item.width} height={item.height} loading="lazy" /><span>View photo ↗</span></button>)}</div>
    <dialog ref={dialog} className="trip-photo-dialog" aria-label="2026 Myrtle Beach photo viewer" onClick={event => { if(event.target === dialog.current) dialog.current.close(); }} onKeyDown={event => { if(event.key === "ArrowLeft") move(-1); if(event.key === "ArrowRight") move(1); }}>
      <div className="trip-photo-toolbar"><span>{selected + 1} / {tripPhotos.length}</span><button autoFocus aria-label="Close photo viewer" onClick={() => dialog.current?.close()}>Close ×</button></div>
      <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />
      <div className="trip-photo-controls"><button onClick={() => move(-1)}>← Previous</button><a href={photo.src} target="_blank" rel="noreferrer">Open full photo ↗</a><button onClick={() => move(1)}>Next →</button></div>
    </dialog>
  </section>;
}
