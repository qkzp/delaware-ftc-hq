import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { LocateFixed, MapPin, Navigation, Search } from "lucide-react";
import type { TeamEvent } from "../types";
import {useHQ} from "../store";
import { hasCoordinates, mapOrigins, nearbyCompetitions, publicCompetitions, sourceNeedsReview, type CompetitionListing, type Point } from "../competition-map";
import "leaflet/dist/leaflet.css";
import "./CompetitionMap.css";

const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const date = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
const time = (t: string) => t ? new Date(`2000-01-01T${t}`).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) : "Time to be confirmed";

export default function CompetitionMap({ events, county, canManage, onOpen, onAdd }: {
  events: TeamEvent[]; county: string; canManage: boolean;
  onOpen: (event: TeamEvent) => void; onAdd: (event: CompetitionListing) => void;
}) {
  const {cloud} = useHQ();
  const allowGeolocation = !cloud.shared;
  const [mapEnabled, setMapEnabled] = useState(false);
  const initialCounty = `${county.replace(/ County$/, "")} County`;
  const [area, setArea] = useState(mapOrigins[initialCounty] ? initialCounty : "New Castle County");
  const [position, setPosition] = useState<Point | null>(null);
  const [radius, setRadius] = useState(50), [query, setQuery] = useState("");
  const [scope, setScope] = useState("All competitions"), [chosen, setChosen] = useState<string | null>(null);
  const [locating, setLocating] = useState(false), [locationMessage, setLocationMessage] = useState("");
  const [mapError, setMapError] = useState("");
  const host = useRef<HTMLDivElement>(null), resultPanel = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null);
  const mounted = useRef(true), locationRequest = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; locationRequest.current++; }; }, []);
  const today = day(), origin = position || mapOrigins[area];
  const listings = useMemo(() => {
    const team: CompetitionListing[] = events.filter(e => e.type === "Competition" && !e.demo && hasCoordinates(e)).map(e => ({
      id: `team-${e.id}`, title:e.title, date:e.date, time:e.time, endTime:e.endTime, kind:"Team competition", location:e.location,
      latitude:e.latitude!, longitude:e.longitude!, source:e.source, checkedAt:e.verification === "verified" ? e.verifiedAt || "" : "", deadline:e.deadline, teamEvent:e,
    }));
    // A scheduled organizer listing appears once, with the team's saved details.
    const official = scope === "All competitions" ? publicCompetitions.filter(e => !team.some(t => t.source === e.source && t.date === e.date)) : publicCompetitions;
    return scope === "Team schedule" ? team : scope === "Organizer listings" ? official : [...official, ...team];
  }, [events, scope]);
  const results = useMemo(() => nearbyCompetitions(listings, origin, radius, today, query), [listings, origin, radius, today, query]);
  const selected = results.find(r => r.event.id === chosen)?.event || null;
  useEffect(() => { if (chosen && resultPanel.current) resultPanel.current.scrollTop = 0; }, [chosen]);
  const missing = events.filter(e => e.type === "Competition" && !e.demo && e.date >= today && !hasCoordinates(e));

  function select(event: CompetitionListing) {
    setChosen(event.id);
    map.current?.setView([event.latitude, event.longitude], 12, { animate: false });
  }
  useEffect(() => {
    if (!mapEnabled) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let instance: LeafletMap | undefined;
    setMapError("");
    void import("leaflet").then(L => {
      if (cancelled || !host.current) return;
      instance = L.map(host.current, { scrollWheelZoom: false, keyboard: true }).setView([origin.latitude, origin.longitude], 9);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on("tileerror", () => { if (!cancelled) setMapError("Map tiles could not load. All event details are still available in the results list."); }).addTo(instance);
      L.circle([origin.latitude, origin.longitude], { radius:radius*1609.344, color:"#0071e3", weight:1, fillOpacity:0.025, interactive:false }).addTo(instance);
      L.circleMarker([origin.latitude, origin.longitude], { radius:6, color:"#fff", weight:3, fillColor:"#0071e3", fillOpacity:1 }).bindTooltip(position ? "Approximate search location" : `${area} starting point`).addTo(instance);
      const bounds = L.latLngBounds([[origin.latitude, origin.longitude]]);
      results.forEach(({event}, index) => {
        const marker = L.marker([event.latitude,event.longitude], {
          icon:L.divIcon({ className:`competition-pin ${event.teamEvent ? "competition-pin-team" : ""}`, html:`<span>${index+1}</span>`, iconSize:[34,34], iconAnchor:[17,34] }),
          title:event.title, alt:`${index+1}. ${event.title}`, keyboard:true,
        }).addTo(instance!);
        const popup = document.createElement("div");
        const heading = document.createElement("strong"); heading.textContent = event.title;
        const detail = document.createElement("p"); detail.textContent = `${date(event.date)} · ${time(event.time)}`;
        const button = document.createElement("button"); button.type="button"; button.className="btn btn-secondary btn-sm"; button.textContent="Show event details"; button.onclick=()=>setChosen(event.id);
        popup.appendChild(heading); popup.appendChild(detail); popup.appendChild(button); marker.bindPopup(popup).on("click",()=>setChosen(event.id));
        bounds.extend([event.latitude,event.longitude]);
      });
      if(results.length) instance.fitBounds(bounds, { padding:[42,42], maxZoom:11 });
      if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(()=>instance?.invalidateSize()); observer.observe(host.current); }
    }).catch(() => { if(!cancelled) setMapError("The interactive map could not load. Use the event list below."); });
    return () => { cancelled=true; observer?.disconnect(); instance?.remove(); if(map.current === instance) map.current=null; };
  }, [origin, area, position, radius, results, mapEnabled]);

  function locate() {
    if (!allowGeolocation) return;
    if (!navigator.geolocation) { setLocationMessage("Location is unavailable in this browser. Choose a county starting point."); return; }
    const request = ++locationRequest.current;
    setLocating(true); setLocationMessage("");
    navigator.geolocation.getCurrentPosition(p => {
      if (!mounted.current || request !== locationRequest.current) return;
      setPosition({ latitude:Math.round(p.coords.latitude*100)/100, longitude:Math.round(p.coords.longitude*100)/100 });
      setLocating(false); setChosen(null); setLocationMessage("Using an approximate location for this visit. Your position is not saved or shared with teammates.");
    }, error => {
      if (!mounted.current || request !== locationRequest.current) return;
      setLocating(false); setLocationMessage(error.code === 1 ? "Location permission was declined. You can still choose a county starting point." : "Your location could not be found. Choose a county starting point or try again.");
    }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
  }

  return <section className="competition-explorer" aria-labelledby="competition-map-title">
    <div className="competition-intro"><div><h2 id="competition-map-title">Find your next competition.</h2><p>Explore scrimmages and qualifiers, then bring the dates into your team’s schedule.</p></div>{allowGeolocation && <button className="btn btn-primary" disabled={locating} onClick={locate}><LocateFixed size={17}/>{locating ? "Finding your location…" : "Use my location"}</button>}</div>
    <div className="competition-controls">
      <label>Starting point<select value={position ? "My approximate location" : area} onChange={e=>{ locationRequest.current++; setLocating(false); setPosition(null); setArea(e.target.value); setLocationMessage(""); setChosen(null); }}>{position && <option>My approximate location</option>}{Object.keys(mapOrigins).map(a=><option key={a}>{a}</option>)}</select></label>
      <label>Within<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[25,50,100,250].map(r=><option value={r} key={r}>{r} miles</option>)}</select></label>
      <label>Show<select value={scope} onChange={e=>setScope(e.target.value)}><option>All competitions</option><option>Organizer listings</option><option>Team schedule</option></select></label>
      <label className="competition-search">Search events<div><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Event, venue, or city"/></div></label>
    </div>
    {locationMessage && <p role="status" className="competition-message">{locationMessage}</p>}
    <p className="competition-privacy">Choose a county starting point; shared workspaces do not request device location. Map tiles stay off until you choose to load them. OpenStreetMap then receives your IP address and viewed map area. Distances are straight-line estimates, not driving distances.</p>
    <div className="competition-layout">
      <div className="competition-map-column">{!mapEnabled && <div className="competition-empty"><p>The event list works without external map requests.</p><button type="button" className="btn btn-secondary" onClick={()=>setMapEnabled(true)}>Load map tiles from OpenStreetMap</button></div>}<div ref={host} className="competition-map" role="region" aria-label="Competition map. Use the adjacent event list for equivalent details."/><div className="competition-map-caption"><span><i/> Organizer listing</span><span><i className="team-dot"/> Team schedule</span><span>Blue circle: search radius</span></div>{mapError && <p role="status" className="competition-message">{mapError}</p>}</div>
      <div className="competition-results" ref={resultPanel}>
        <div className="competition-result-heading"><h3>Nearby events</h3><span role="status">{results.length} found</span></div>
        {selected && <article className="competition-detail" aria-label="Selected competition">
          <div className="competition-detail-top"><span>{selected.kind}</span><button className="text-btn" onClick={()=>setChosen(null)} aria-label="Close selected competition details">Close</button></div>
          <h3>{selected.title}</h3><p><strong>{date(selected.date)}</strong> · {time(selected.time)}{selected.endTime && `–${time(selected.endTime)}`} (venue local time)</p><p><MapPin size={15}/>{selected.location}</p>
          {selected.yearInferred && <p className="competition-message">Year inferred from the current season; confirm the full date with the organizer.</p>}
          <p>{selected.teamEvent ? selected.teamEvent.verification === "verified" ? "Mentor verified" : "Team-created · needs source verification" : "Organizer source checked"}{selected.checkedAt && ` · ${date(selected.checkedAt)}`}{sourceNeedsReview(selected.checkedAt,today) && " · Recheck before planning"}</p>
          <p>{selected.deadline ? `Registration deadline: ${date(selected.deadline)}${selected.deadline < today ? " · Passed; ask the organizer about availability" : ""}` : "Registration deadline not confirmed. Check with the organizer."}</p>
          <div className="competition-detail-actions">{selected.source.startsWith("https://") && <a href={selected.source} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Official source ↗</a>}<a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}><Navigation size={14}/>Directions</a>{selected.teamEvent ? <button className="btn btn-primary btn-sm" onClick={()=>onOpen(selected.teamEvent!)}>Open team event</button> : canManage && <button className="btn btn-primary btn-sm" onClick={()=>onAdd(selected)}>Review & add to schedule</button>}</div>
        </article>}
        <ol className="competition-result-list">{results.map(({event,miles},index)=><li key={event.id}><button className={chosen === event.id ? "selected" : ""} aria-pressed={chosen === event.id} onClick={()=>select(event)}><span className="competition-result-number">{index+1}</span><span><strong>{event.title}</strong><small>{date(event.date)} · {event.kind}</small><small>{event.location}</small><span className="competition-result-distance">About {Math.round(miles)} mi away{event.teamEvent ? " · Team schedule" : ""}</span></span></button></li>)}</ol>
        {!results.length && <div className="competition-empty"><h3>No matching competitions</h3><p>Try a larger radius or clear your search. Coverage currently includes six checked Delaware and southeastern Pennsylvania events, plus your team’s mapped competitions.</p><button className="btn btn-secondary btn-sm" onClick={()=>{setRadius(250);setQuery("");setScope("All competitions");}}>Broaden search</button></div>}
      </div>
    </div>
    {!!missing.length && <div className="competition-unmapped"><h3>Team events needing a map location</h3><p>Add venue coordinates to show these competitions on the map.</p>{missing.map(e=><button key={e.id} className="btn btn-secondary btn-sm" onClick={()=>onOpen(e)}>{e.title}</button>)}</div>}
    <p className="competition-coverage">Regional listings were checked November 1, 2026. This is a curated selection, not a live nationwide feed. Past events are hidden; sources older than 30 days need rechecking. Confirm registration, eligibility, and travel plans with the organizer. Find more at <a href="https://ftc-events.firstinspires.org/" target="_blank" rel="noreferrer">FIRST events ↗</a> and <a href="https://firstdelaware.org/events" target="_blank" rel="noreferrer">FIRST Delaware ↗</a>.</p>
  </section>;
}
