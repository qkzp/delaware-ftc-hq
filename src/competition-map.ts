import type { TeamEvent } from "./types";

export type Point = { latitude: number; longitude: number };
export type CompetitionListing = Point & {
  id: string; title: string; date: string; time: string; endTime: string;
  kind: string; location: string; source: string; checkedAt: string;
  deadline?: string; teamEvent?: TeamEvent;
};

export const mapOrigins: Record<string, Point> = {
  "New Castle County": { latitude: 39.74, longitude: -75.55 },
  "Kent County": { latitude: 39.16, longitude: -75.52 },
  "Sussex County": { latitude: 38.69, longitude: -75.39 },
};
export function hasCoordinates(value: { latitude?: number; longitude?: number }): value is Point {
  return typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 && typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
/** Great-circle distance; never represents road distance or travel time. */
export function distanceMiles(a: Point, b: Point) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function nearbyCompetitions(list: CompetitionListing[], origin: Point, radius: number, today: string, query = "") {
  const term = query.trim().toLowerCase();
  return list.filter(e => e.date >= today && hasCoordinates(e) && (!term || `${e.title} ${e.location} ${e.kind}`.toLowerCase().includes(term)))
    .map(event => ({ event, miles: distanceMiles(origin, event) }))
    .filter(e => e.miles <= radius)
    .sort((a, b) => a.miles - b.miles || a.event.date.localeCompare(b.event.date));
}
export function sourceNeedsReview(checkedAt: string, today: string) {
  const checked = Date.parse(`${checkedAt}T12:00:00Z`);
  return !Number.isFinite(checked) || Date.parse(`${today}T12:00:00Z`) - checked > 30 * 86400000;
}

// Curated regional coverage, not a live or nationwide event feed.
// PA coordinates come from the organizer's public data-venue map records.
// DE coordinates come from the organizer's linked venue maps.
const pa = "https://www.ftcpenn.org/ftc-events/2026-2027-season/";
export const publicCompetitions: CompetitionListing[] = [
  { id: "usde-archmere-2026", title: "FTC BIOBUZZ Kickoff Scrimmage", date: "2026-11-21", time: "09:00", endTime: "14:00", kind: "Scrimmage", location: "Archmere Academy · 3600 Philadelphia Pike, Claymont, DE", latitude: 39.801604, longitude: -75.454112, source: "https://firstdelaware.org/event-archmere", checkedAt: "2026-11-01" },
  { id: "uspa-ksn-2026", title: "Longhorn Roundup Scrimmage", date: "2026-11-07", time: "08:00", endTime: "16:00", kind: "Scrimmage", location: "Charles F Patton Middle School · 760 Unionville Rd, Kennett Square, PA", latitude: 39.885493, longitude: -75.720303, source: pa + "longhorn-roundup-scrimmage", checkedAt: "2026-11-01", deadline: "2026-10-31" },
  { id: "usde-csw-2026", title: "Applied Forces Scrimmage", date: "2026-12-05", time: "08:00", endTime: "15:00", kind: "Scrimmage", location: "Charter School of Wilmington · 100 N Dupont Rd, Wilmington, DE", latitude: 39.753851, longitude: -75.587810, source: "https://firstdelaware.org/event-csw-scrimmage", checkedAt: "2026-11-01" },
  { id: "uspa-laq1-2026", title: "Lancaster Area Qualifier", date: "2026-12-12", time: "07:45", endTime: "17:00", kind: "Qualifying tournament", location: "McCaskey East High School · 1051 Lehigh Ave, Lancaster, PA", latitude: 40.048347, longitude: -76.285390, source: pa + "lancaster-area-qualifier", checkedAt: "2026-11-01", deadline: "2026-11-28" },
  { id: "uspa-beq1-2027", title: "Southeastern Pennsylvania Qualifier", date: "2027-01-23", time: "07:45", endTime: "18:15", kind: "Qualifying tournament", location: "Bensalem High School · 4319 Hulmeville Rd, Bensalem, PA", latitude: 40.112657, longitude: -74.931530, source: pa + "southeastern-pennsylvania-qualifier", checkedAt: "2026-11-01", deadline: "2027-01-09" },
  { id: "uspa-coq1-2027", title: "Eastern Pennsylvania Qualifier", date: "2027-02-06", time: "07:45", endTime: "18:15", kind: "Qualifying tournament", location: "Coatesville Area Senior High School · 1445 E Lincoln Hwy, Coatesville, PA · Enter on Foundry Rd", latitude: 39.990433, longitude: -75.796810, source: pa + "eastern-pennsylvania-qualifier", checkedAt: "2026-11-01", deadline: "2027-01-23" },
];
