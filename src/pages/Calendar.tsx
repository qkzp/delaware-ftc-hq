import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileUp,
  MapPin,
  Plus,
  Repeat2,
  Users,
} from "lucide-react";
import { useHQ } from "../store";
import { Badge, EmptyState, Field, Modal, PageHeader } from "../components/ui";
import type { TeamEvent } from "../types";
import "./tasks-calendar.css";

const types: TeamEvent["type"][] = [
  "Build night",
  "Competition",
  "Outreach",
  "Deadline",
  "Meeting",
];
const colors: Record<string, { color: string; bg: string }> = {
  "Build night": { color: "#60656d", bg: "#f4f4f2" },
  Competition: { color: "#191d23", bg: "#f4f4f2" },
  Outreach: { color: "#60656d", bg: "#f4f4f2" },
  Deadline: { color: "#bd4728", bg: "#ffffff" },
  Meeting: { color: "#60656d", bg: "#f4f4f2" },
};
const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dateLabel = (date: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(
    "en-US",
    opts || { weekday: "long", month: "long", day: "numeric" },
  );
const timeLabel = (time: string) =>
  time
    ? new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Time to be confirmed";
const safeUrl = (value: string) => /^https?:\/\//i.test(value);
const eventStyle = (type: string) =>
  ({
    "--event-color": colors[type]?.color || "#60656d",
    "--event-bg": colors[type]?.bg || "#f4f4f2",
  }) as React.CSSProperties;

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted)
    throw new Error(
      "A quoted CSV field is not closed. Check the file and try again.",
    );
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function parseImport(
  text: string,
  name: string,
  base: { teamId: string; seasonId: string },
): TeamEvent[] {
  const baseEvent = (): TeamEvent => ({
    id: crypto.randomUUID(),
    ...base,
    demo: false,
    title: "",
    date: "",
    time: "17:00",
    endTime: "19:00",
    type: "Meeting",
    location: "",
    owner: "Alex (you)",
    agenda: "",
    notes: "",
    source: `Team-provided ${name.toLowerCase().endsWith(".ics") ? "ICS" : "CSV"} import`,
    lastSynced: dateKey(),
    rsvp: false,
    recurring: "None",
  });
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) &&
    dateKey(new Date(`${value}T12:00:00`)) === value;
  let records: TeamEvent[] = [];
  if (
    name.toLowerCase().endsWith(".ics") ||
    text.trim().startsWith("BEGIN:VCALENDAR")
  ) {
    const unfolded = text.replace(/\r?\n[ \t]/g, "");
    const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    const zones = Array.from(
      unfolded.matchAll(/^DT(?:START|END);TZID=([^:;\r\n]+)/gim),
      (m) => m[1].replace(/^"|"$/g, ""),
    );
    if (
      zones.some((zone) => zone !== "America/New_York" && zone !== "US/Eastern")
    )
      throw new Error(
        "This ICS file uses another timezone. Export it in America/New_York or use a CSV with your team’s local event times.",
      );
    const read = (block: string, key: string) => {
      const match = block.match(
        new RegExp(`^${key}(?:;[^:\\r\\n]+)?:(.*)$`, "mi"),
      );
      return match
        ? match[1]
            .trim()
            .replace(/\\n/gi, "\n")
            .replace(/\\,/g, ",")
            .replace(/\\;/g, ";")
            .replace(/\\\\/g, "\\")
        : "";
    };
    const localIcs = (value: string) => {
      if (!value.endsWith("Z")) return value;
      const instant = new Date(
        `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15) || "00"}Z`,
      );
      if (Number.isNaN(instant.getTime())) return "";
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(instant);
      const part = (type: string) =>
        parts.find((p) => p.type === type)?.value || "";
      return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}00`;
    };
    records = blocks.map((block) => {
      const e = baseEvent();
      const start = localIcs(read(block, "DTSTART")),
        end = localIcs(read(block, "DTEND"));
      e.title = read(block, "SUMMARY");
      e.date =
        start.length >= 8
          ? `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
          : "";
      e.time = start.includes("T")
        ? `${start.slice(9, 11)}:${start.slice(11, 13)}`
        : "";
      e.endTime = end.includes("T")
        ? `${end.slice(9, 11)}:${end.slice(11, 13)}`
        : "";
      e.location = read(block, "LOCATION");
      e.agenda = read(block, "DESCRIPTION");
      e.notes = read(block, "RRULE")
        ? "Recurring source event imported as this occurrence only. Confirm the remaining dates with your team lead."
        : "";
      return e;
    });
  } else {
    const rows = csvRows(text.replace(/^\uFEFF/, ""));
    if (rows.length < 2)
      throw new Error(
        "The CSV needs a header and at least one event. Download the template for an example.",
      );
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    if (!headers.includes("title") || !headers.includes("date"))
      throw new Error(
        "The CSV must include title and date columns. Use YYYY-MM-DD dates.",
      );
    records = rows.slice(1).map((row) => {
      const e = baseEvent();
      const get = (key: string) => row[headers.indexOf(key)]?.trim() || "";
      e.title = get("title");
      e.date = get("date");
      e.time = get("time") || "";
      e.endTime = get("endtime") || get("end_time") || "";
      e.location = get("location");
      e.owner = get("owner") || "Alex (you)";
      e.agenda = get("agenda");
      e.notes = get("notes");
      e.type = types.includes(get("type") as TeamEvent["type"])
        ? (get("type") as TeamEvent["type"])
        : "Meeting";
      return e;
    });
  }
  if (!records.length)
    throw new Error(
      "No events found. Choose a CSV calendar file or an ICS file containing VEVENT records.",
    );
  if (records.length > 200)
    throw new Error("Please import at most 200 events at a time.");
  const invalid = records.find(
    (e) =>
      !e.title ||
      !validDate(e.date) ||
      (e.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) ||
      (e.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.endTime)),
  );
  if (invalid)
    throw new Error(
      `Check “${invalid.title || "Untitled event"}”. Every event needs a title, a valid YYYY-MM-DD date, and optional 24-hour HH:MM times.`,
    );
  return records;
}

export default function CalendarPage() {
  const {
    data,
    canManage,
    saveRecord,
    removeRecord,
    notify,
    focusRecord,
    clearFocusRecord,
  } = useHQ();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [view, setView] = useState<"Month" | "Agenda" | "Season">("Agenda");
  const [typeFilter, setTypeFilter] = useState("All events");
  const [selected, setSelected] = useState<TeamEvent | null>(null);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRecords, setImportRecords] = useState<TeamEvent[]>([]);
  const [importError, setImportError] = useState("");
  const [importName, setImportName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusRecord?.page !== "calendar") return;
    const event = data.events.find((e) => e.id === focusRecord.id);
    if (event) {
      setEditing(null);
      setImporting(false);
      setSelected(event);
      setMonth(new Date(`${event.date.slice(0, 7)}-01T12:00:00`));
      setTypeFilter("All events");
    } else notify("This event is no longer in this workspace.");
    clearFocusRecord();
  }, [focusRecord, data.events, clearFocusRecord]);
  const events = useMemo(
    () =>
      data.events
        .filter((e) => typeFilter === "All events" || e.type === typeFilter)
        .sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
        ),
    [data.events, typeFilter],
  );
  const monthEvents = events.filter((e) =>
    e.date.startsWith(
      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
    ),
  );
  const gridDays = useMemo(() => {
    const first = new Date(month);
    first.setDate(1 - first.getDay());
    return Array.from(
      { length: 42 },
      (_, i) =>
        new Date(first.getFullYear(), first.getMonth(), first.getDate() + i),
    );
  }, [month]);
  const seasonMonths = Array.from(
    new Set(events.map((e) => e.date.slice(0, 7))),
  );
  const patch = (update: Partial<TeamEvent>) =>
    setEditing((e) => (e ? { ...e, ...update } : e));
  const openEdit = (event: TeamEvent) => {
    setSelected(null);
    setEditing({ ...event });
    setDeleting(false);
  };
  const create = (date = dateKey()) =>
    openEdit({
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      title: "",
      date,
      time: "17:00",
      endTime: "19:00",
      type: "Build night",
      location: "",
      owner: "Alex (you)",
      agenda: "",
      notes: "",
      source: "Manually added by team",
      lastSynced: "",
      rsvp: false,
      recurring: "None",
    });
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !canManage) return;
    if (editing.time && editing.endTime && editing.endTime <= editing.time) {
      notify("End time should be later than start time.");
      return;
    }
    const isNew = !data.events.some((e) => e.id === editing.id);
    const record = { ...editing, title: editing.title.trim() };
    if (!record.title) return;
    saveRecord("events", record);
    if (isNew && record.recurring === "Weekly")
      for (let i = 1; i < 8; i++) {
        const d = new Date(`${record.date}T12:00:00`);
        d.setDate(d.getDate() + 7 * i);
        saveRecord("events", {
          ...record,
          id: crypto.randomUUID(),
          date: dateKey(d),
          rsvp: false,
        });
      }
    setMonth(new Date(`${record.date.slice(0, 7)}-01T12:00:00`));
    setEditing(null);
    notify(
      isNew && record.recurring === "Weekly"
        ? "Eight weekly meetings added. Edit each occurrence as needed."
        : isNew
          ? "Event added to your team calendar."
          : "Event updated.",
    );
  };
  const rsvp = (event: TeamEvent) => {
    saveRecord("events", { ...event, rsvp: !event.rsvp });
    if (selected?.id === event.id) setSelected({ ...event, rsvp: !event.rsvp });
    notify(event.rsvp ? "RSVP removed." : "RSVP saved.");
  };
  const download = (text: string, name: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const exportCalendar = () => {
    const escape = (v: string) =>
      v
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MyFTCSpae//Team Calendar//EN",
      ...events.flatMap((e) => [
        "BEGIN:VEVENT",
        `UID:${e.id}@student-hq.local`,
        `DTSTAMP:${new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
        e.time
          ? `DTSTART:${e.date.replace(/-/g, "")}T${e.time.replace(":", "")}00`
          : `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`,
        ...(e.endTime
          ? [
              `DTEND:${e.date.replace(/-/g, "")}T${e.endTime.replace(":", "")}00`,
            ]
          : []),
        `SUMMARY:${escape(`${e.demo ? "[DEMO] " : ""}${e.title}`)}`,
        `LOCATION:${escape(e.location)}`,
        `DESCRIPTION:${escape(e.agenda)}`,
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ];
    download(lines.join("\r\n"), "myftcspae-calendar.ics", "text/calendar");
    notify("Calendar exported. Team event times use the local team timezone.");
  };
  const inspectImport = async (file?: File) => {
    if (!file) return;
    setImportError("");
    setImportRecords([]);
    setImportName(file.name);
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a calendar file smaller than 2 MB.");
      setImportRecords(
        parseImport(await file.text(), file.name, {
          teamId: data.teamId,
          seasonId: data.seasonId,
        }),
      );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Could not read this calendar file.",
      );
    }
  };
  const performImport = () => {
    const seen = new Set(
      data.events.map(
        (e) => `${e.title.toLowerCase().trim()}|${e.date}|${e.time}`,
      ),
    );
    let imported = 0;
    for (const e of importRecords) {
      const key = `${e.title.toLowerCase().trim()}|${e.date}|${e.time}`;
      if (!seen.has(key)) {
        saveRecord("events", e);
        seen.add(key);
        imported++;
      }
    }
    setImporting(false);
    setImportRecords([]);
    notify(
      `${imported} event${imported === 1 ? "" : "s"} imported. ${importRecords.length - imported} duplicate${importRecords.length - imported === 1 ? "" : "s"} skipped.`,
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE / SCHEDULE"
        title="Schedule"
        description="Meetings, competitions, outreach, and team deadlines."
        actions={
          <div className="inline">
            <button
              className="btn btn-secondary"
              onClick={exportCalendar}
              aria-label="Export calendar"
            >
              <ArrowDownToLine size={16} />
              <span className="tc-desktop-label">Export</span>
            </button>
            {canManage && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setImporting(true);
                    setImportRecords([]);
                    setImportError("");
                    setImportName("");
                  }}
                >
                  <FileUp size={16} />
                  <span className="tc-desktop-label">Import</span>
                </button>
                <button className="btn btn-primary" onClick={() => create()}>
                  <Plus size={17} />
                  New event
                </button>
              </>
            )}
          </div>
        }
      />
      <div className="tc-calendar-top">
        <div className="tc-calendar-month">
          <h2>
            {view === "Season"
              ? data.seasonName
              : month.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
          </h2>
          {view !== "Season" && (
            <>
              <button
                className="icon-btn"
                aria-label="Previous month"
                onClick={() =>
                  setMonth(
                    (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="icon-btn"
                aria-label="Next month"
                onClick={() =>
                  setMonth(
                    (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={17} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  )
                }
              >
                Today
              </button>
            </>
          )}
        </div>
        <div className="filter-tabs" aria-label="Calendar view">
          {(["Month", "Agenda", "Season"] as const).map((v) => (
            <button
              className={view === v ? "active" : ""}
              key={v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="filters tc-task-filters">
        <select
          aria-label="Filter event type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option>All events</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 11 }}>
          {view === "Season" ? events.length : monthEvents.length} event
          {(view === "Season" ? events.length : monthEvents.length) === 1
            ? ""
            : "s"}{" "}
          · Team-managed calendar
        </span>
      </div>
      <div className="tc-calendar-legend">
        {types.map((t) => (
          <span style={eventStyle(t)} key={t}>
            <i />
            {t}
          </span>
        ))}
      </div>
      {view === "Month" ? (
        <div className="tc-calendar">
          <div className="tc-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="tc-calendar-grid">
            {gridDays.map((d) => (
              <div
                className={`tc-calendar-cell ${d.getMonth() !== month.getMonth() ? "outside" : ""} ${dateKey(d) === dateKey() ? "today" : ""}`}
                key={dateKey(d)}
              >
                <div className="tc-day-heading">
                  <span
                    className="tc-day-number"
                    aria-label={dateLabel(dateKey(d))}
                  >
                    {d.getDate()}
                  </span>
                  {canManage && (
                    <button
                      className="tc-add-day"
                      aria-label={`Add event on ${dateLabel(dateKey(d))}`}
                      onClick={() => create(dateKey(d))}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                {events
                  .filter((e) => e.date === dateKey(d))
                  .map((event) => (
                    <button
                      className="tc-calendar-event"
                      style={eventStyle(event.type)}
                      key={event.id}
                      onClick={() => setSelected(event)}
                      title={`${event.demo ? "Demo · " : ""}${event.title} · ${timeLabel(event.time)}`}
                    >
                      <strong>
                        {event.demo && "◦ "}
                        {event.title}
                      </strong>
                      <small>
                        {timeLabel(event.time)}
                        {event.rsvp ? " · Going" : ""}
                      </small>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ) : view === "Agenda" ? (
        monthEvents.length ? (
          <div className="tc-agenda-list">
            {monthEvents.map((event) => (
              <article className="card tc-agenda-date" key={event.id}>
                <div className="tc-date-tile">
                  <span>{dateLabel(event.date, { weekday: "short" })}</span>
                  <strong>
                    {new Date(`${event.date}T12:00:00`).getDate()}
                  </strong>
                </div>
                <div className="tc-agenda-info">
                  <Badge
                    tone={
                      event.type === "Competition"
                        ? "purple"
                        : event.type === "Deadline"
                          ? "amber"
                          : "green"
                    }
                  >
                    {event.type}
                  </Badge>
                  <h3>{event.title}</h3>
                  <div className="tc-agenda-details">
                    <span>
                      <Clock3 size={12} />
                      {timeLabel(event.time)}
                      {event.endTime && `–${timeLabel(event.endTime)}`}
                    </span>
                    <span>
                      <MapPin size={12} />
                      {event.location || "Location to be confirmed"}
                    </span>
                    {event.recurring === "Weekly" && (
                      <span>
                        <Repeat2 size={12} />
                        Weekly series
                      </span>
                    )}
                  </div>
                  {event.agenda && <p>{event.agenda.split("\n")[0]}</p>}
                </div>
                <div className="tc-agenda-side">
                  {event.demo ? (
                    <Badge tone="gray">Demo event</Badge>
                  ) : (
                    <Badge tone="gray">Team only</Badge>
                  )}
                  <div className="tc-agenda-actions">
                    <button
                      className={`btn ${event.rsvp ? "btn-primary" : "btn-secondary"} btn-sm`}
                      onClick={() => rsvp(event)}
                    >
                      {event.rsvp ? (
                        <>
                          <Check size={13} />
                          Going
                        </>
                      ) : (
                        "RSVP"
                      )}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelected(event)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No events this month"
            description="Add an event or import the team calendar."
            action={
              canManage ? (
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    create(
                      `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`,
                    )
                  }
                >
                  <Plus size={16} />
                  Add an event
                </button>
              ) : undefined
            }
          />
        )
      ) : events.length ? (
        <div>
          {seasonMonths.map((m) => (
            <section className="tc-season-month" key={m}>
              <h2 className="tc-season-label">
                {dateLabel(`${m}-01`, { month: "long" })}
                <small>{m.slice(0, 4)}</small>
              </h2>
              <div className="tc-season-events">
                {events
                  .filter((e) => e.date.startsWith(m))
                  .map((event) => (
                    <article className="tc-season-event" key={event.id}>
                      <div className="tc-season-event-info">
                        <div className="inline">
                          <Badge
                            tone={
                              event.type === "Competition"
                                ? "purple"
                                : event.type === "Deadline"
                                  ? "amber"
                                  : "green"
                            }
                          >
                            {event.type}
                          </Badge>
                          {event.demo && (
                            <span className="tc-demo-mark">Demo</span>
                          )}
                        </div>
                        <h3>{event.title}</h3>
                        <p>
                          {dateLabel(event.date, {
                            month: "short",
                            day: "numeric",
                            weekday: "short",
                          })}{" "}
                          · {timeLabel(event.time)} ·{" "}
                          {event.location || "Location to be confirmed"}
                        </p>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelected(event)}
                      >
                        View event
                      </button>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No scheduled events"
          description="Add an event or import the team calendar."
          action={
            canManage ? (
              <button className="btn btn-primary" onClick={() => create()}>
                Add first event
              </button>
            ) : undefined
          }
        />
      )}
      <p className="tc-page-footnote">
        Events are maintained by your team. Demo events are practice examples,
        not official Delaware competition dates. Local team times · No live
        FIRST integration.
      </p>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="inline">
            <Badge tone="green">{selected.type}</Badge>
            {selected.demo && (
              <Badge tone="amber">Demo event · not an official schedule</Badge>
            )}
          </div>
          <div className="tc-event-detail-meta">
            <span>
              <CalendarDays size={15} />
              {dateLabel(selected.date)}
            </span>
            <span>
              <Clock3 size={15} />
              {timeLabel(selected.time)}
              {selected.endTime && ` – ${timeLabel(selected.endTime)}`}
            </span>
            <span>
              <MapPin size={15} />
              {selected.location || "Ask your team lead for the location"}
            </span>
            <span>
              <Users size={15} />
              Owner: {selected.owner}
            </span>
          </div>
          <div className="tc-event-detail-block">
            <h3>Agenda</h3>
            <p>
              {selected.agenda ||
                "No agenda yet. A team lead can add the goals and plan for this event."}
            </p>
          </div>
          {selected.notes && (
            <div className="tc-event-detail-block">
              <h3>Team notes & decisions</h3>
              <p>{selected.notes}</p>
            </div>
          )}
          {data.tasks.some((t) => t.due === selected.date) && (
            <div className="tc-event-detail-block">
              <h3>Tasks due that day</h3>
              {data.tasks
                .filter((t) => t.due === selected.date)
                .map((t) => (
                  <p key={t.id}>
                    {t.status === "Done" ? "✓" : "○"} {t.title} · {t.owner}
                  </p>
                ))}
            </div>
          )}
          <p className="tc-event-source">
            Source:{" "}
            {safeUrl(selected.source) ? (
              <a href={selected.source} target="_blank" rel="noreferrer">
                {selected.source}
              </a>
            ) : (
              selected.source || "Manually added by team"
            )}
            {selected.lastSynced &&
              ` · Imported ${dateLabel(selected.lastSynced, { month: "short", day: "numeric", year: "numeric" })}`}
            {selected.recurring === "Weekly" && (
              <>
                <br />
                Part of a weekly meeting series. Changes apply to this
                occurrence.
              </>
            )}
          </p>
          <div className="form-actions">
            <button
              className={`btn ${selected.rsvp ? "btn-primary" : "btn-secondary"}`}
              onClick={() => rsvp(selected)}
            >
              {selected.rsvp ? (
                <>
                  <Check size={15} />
                  You’re going
                </>
              ) : (
                "I’m going"
              )}
            </button>
            <span className="spacer" />
            {canManage && (
              <button
                className="btn btn-secondary"
                onClick={() => openEdit(selected)}
              >
                Edit event
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal
          title={
            data.events.some((e) => e.id === editing.id)
              ? "Edit team event"
              : "Add event"
          }
          onClose={() => setEditing(null)}
          wide
        >
          <form className="stack" onSubmit={save}>
            <Field label="Event title">
              <input
                required
                maxLength={160}
                value={editing.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="For example, Saturday build & test"
              />
            </Field>
            <div className="form-grid">
              <Field label="Event type">
                <select
                  value={editing.type}
                  onChange={(e) =>
                    patch({ type: e.target.value as TeamEvent["type"] })
                  }
                >
                  {types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Event owner">
                <input
                  required
                  value={editing.owner}
                  onChange={(e) => patch({ owner: e.target.value })}
                  placeholder="Name or team role"
                />
              </Field>
              <Field label="Date">
                <input
                  required
                  type="date"
                  value={editing.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </Field>
              <Field
                label="Repeat"
                hint={
                  data.events.some((e) => e.id === editing.id)
                    ? "Changes apply to this occurrence."
                    : "Weekly creates eight editable occurrences."
                }
              >
                <select
                  disabled={data.events.some((e) => e.id === editing.id)}
                  value={editing.recurring}
                  onChange={(e) =>
                    patch({
                      recurring: e.target.value as TeamEvent["recurring"],
                    })
                  }
                >
                  <option>None</option>
                  <option>Weekly</option>
                </select>
              </Field>
              <Field label="Start time">
                <input
                  type="time"
                  value={editing.time}
                  onChange={(e) => patch({ time: e.target.value })}
                />
              </Field>
              <Field label="End time">
                <input
                  type="time"
                  value={editing.endTime}
                  onChange={(e) => patch({ endTime: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Location">
              <input
                value={editing.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="Team workshop or event venue"
              />
            </Field>
            <Field
              label="Agenda"
              hint="Make it easy for every student to arrive ready."
            >
              <textarea
                rows={4}
                value={editing.agenda}
                onChange={(e) => patch({ agenda: e.target.value })}
                placeholder={
                  "1. Quick check-in and goals\n2. Work in subteams\n3. Test, document, and choose next steps"
                }
              />
            </Field>
            <div className="inline" style={{ flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 11 }}>
                Quick template:
              </span>
              {["Build night", "Design review", "Competition debrief"].map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      patch({
                        agenda:
                          t === "Build night"
                            ? "1. Check-in: what is blocked? (5 min)\n2. Build and code in subteams (60 min)\n3. Test together and log results (20 min)\n4. Clean up and assign next steps (10 min)"
                            : t === "Design review"
                              ? "1. State the problem and constraints (5 min)\n2. Compare designs and test evidence (15 min)\n3. Decide and record why (10 min)\n4. Assign the next prototype and test (5 min)"
                              : "1. Review the event goals\n2. Review match observations and robot issues\n3. Record what worked and what to change\n4. Choose three improvements and assign owners",
                      })
                    }
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            <Field label="Notes & decisions">
              <textarea
                rows={3}
                value={editing.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Keep the decision and next action together."
              />
            </Field>
            <Field
              label="Official source URL, if available"
              hint="Link the real source. Adding a URL does not automatically verify an event."
            >
              <input
                type={safeUrl(editing.source) ? "url" : "text"}
                value={editing.source}
                onChange={(e) => patch({ source: e.target.value })}
                placeholder="https://… or Manually added by team"
              />
            </Field>
            {editing.demo && (
              <Badge tone="amber">
                This remains a clearly labeled demo event
              </Badge>
            )}
            <div className="form-actions">
              {data.events.some((e) => e.id === editing.id) && (
                <button
                  className="btn btn-ghost tc-delete"
                  type="button"
                  onClick={() => {
                    if (!deleting) {
                      setDeleting(true);
                      return;
                    }
                    removeRecord("events", editing.id);
                    setEditing(null);
                  }}
                >
                  {deleting ? "Confirm delete" : "Delete event"}
                </button>
              )}
              <span className="spacer" />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                Save event
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {importing && (
        <Modal title="Import team calendar" onClose={() => setImporting(false)}>
          <div className="tc-import-panel">
            <p>
              Import a team-provided CSV or ICS file. You’ll review the events
              before they’re added. This does not connect to a live event feed.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() =>
                download(
                  "title,date,time,endTime,type,location,owner,agenda\nExample team build night,2026-11-07,17:00,19:00,Build night,Team workshop,Alex (you),Build and test the next prototype\n",
                  "myftcspae-events-template.csv",
                  "text/csv",
                )
              }
            >
              <ArrowDownToLine size={15} />
              Download CSV template
            </button>
            <Field
              label="Choose a calendar file"
              hint="CSV dates: YYYY-MM-DD. Times: HH:MM in America/New_York. ICS UTC times are converted to Eastern. Recurring rules import the listed occurrence only; confirm other dates with your team lead."
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.ics,text/csv,text/calendar"
                onChange={(e) => void inspectImport(e.target.files?.[0])}
              />
            </Field>
            {importError && (
              <div role="alert" className="tc-import-error">
                {importError}
              </div>
            )}
            {importRecords.length > 0 && (
              <>
                <p>
                  <strong>
                    {importRecords.length} event
                    {importRecords.length === 1 ? "" : "s"}
                  </strong>{" "}
                  ready from {importName}. Exact title/date/time duplicates will
                  be skipped.
                </p>
                <div
                  className="tc-event-detail-block"
                  style={{ maxHeight: 260, overflow: "auto" }}
                >
                  {importRecords.map((e) => (
                    <p key={e.id}>
                      {dateLabel(e.date, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · {e.title}
                    </p>
                  ))}
                </div>
              </>
            )}
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setImporting(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!importRecords.length || !!importError}
                onClick={performImport}
              >
                Import {importRecords.length || ""} events
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
