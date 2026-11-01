import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile production modules in memory, without generated files in the project.
async function moduleUrl(name, replacements = {}) {
  const source = await readFile(
    new URL(`../src/${name}.ts`, import.meta.url),
    "utf8",
  );
  let code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  for (const [specifier, url] of Object.entries(replacements))
    code = code
      .replaceAll(`'${specifier}'`, JSON.stringify(url))
      .replaceAll(`"${specifier}"`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const utilsUrl = await moduleUrl("utils");
const { hasCoordinates, distanceMiles, nearbyCompetitions, sourceNeedsReview, publicCompetitions } = await import(await moduleUrl("competition-map"));
const { createDemoData } = await import(
  await moduleUrl("seed", { "./utils": utilsUrl })
);
const {
  validateData,
  localRepository,
  STORAGE_KEY,
  RECOVERY_KEY,
  RecoveryRequiredError,
} = await import(await moduleUrl("persistence"));
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const api = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: api,
    configurable: true,
    writable: true,
  });
  return api;
}
function changed(mutate) {
  const data = createDemoData();
  mutate(data);
  return data;
}

test("map coordinates round-trip and invalid or incomplete venue positions are rejected", () => {
  const data = changed(d => { d.events[0].latitude = 39.75; d.events[0].longitude = -75.59; });
  assert.equal(validateData(JSON.parse(JSON.stringify(data))), true);
  for (const point of [{latitude:91,longitude:0},{latitude:0,longitude:-181},{latitude:NaN,longitude:0},{latitude:0,longitude:Infinity},{latitude:39},{longitude:-75},{latitude:"39",longitude:-75}]) {
    assert.equal(hasCoordinates(point), false);
    const invalid = createDemoData(); Object.assign(invalid.events[0], point);
    assert.equal(validateData(invalid), false);
  }
  assert.equal(hasCoordinates({latitude:0,longitude:0}), true);
});
test("nearby search uses great-circle miles, filters dates and text, and sorts by distance", () => {
  const origin = {latitude:0,longitude:0};
  assert.equal(distanceMiles(origin,origin), 0);
  assert.ok(Math.abs(distanceMiles(origin,{latitude:0,longitude:1})-69.0934)<.001);
  assert.ok(Number.isFinite(distanceMiles(origin,{latitude:0,longitude:180})));
  const event = publicCompetitions[0];
  const list = [{...event,id:"far",latitude:0,longitude:1,title:"Qualifier"},{...event,id:"near",latitude:0,longitude:.1,title:"Qualifier"},{...event,id:"past",latitude:0,longitude:0,date:"2025-01-01"},{...event,id:"bad",latitude:Infinity}];
  const matches = nearbyCompetitions(list,origin,100,"2026-11-01","qualifier");
  assert.deepEqual(matches.map(m=>m.event.id),["near","far"]);
  assert.deepEqual(nearbyCompetitions(list,origin,25,"2026-11-01","qualifier").map(m=>m.event.id),["near"]);
  assert.equal(nearbyCompetitions(list,origin,100,"2026-11-01","no match").length,0);
});
test("curated competitions retain dated HTTPS sources and stale checks are visible", () => {
  assert.equal(new Set(publicCompetitions.map(e=>e.id)).size,6);
  for (const event of publicCompetitions) {
    assert.ok(hasCoordinates(event)); assert.match(event.source,/^https:\/\/(www\.ftcpenn\.org|firstdelaware\.org)\//);
    assert.equal(sourceNeedsReview(event.checkedAt,"2026-11-01"),false);
    assert.equal(sourceNeedsReview(event.checkedAt,"2026-12-02"),true);
  }
  assert.equal(sourceNeedsReview("","2026-11-01"),true);
  assert.equal(sourceNeedsReview("bad","2026-11-01"),true);
});

test("demo seed and a JSON round trip satisfy the complete import contract", () => {
  const data = createDemoData();
  assert.equal(validateData(data), true);
  assert.equal(validateData(JSON.parse(JSON.stringify(data))), true);
  assert.ok(data.events.every((e) => e.demo));
  assert.ok(data.sponsors.every((s) => s.demo));
  assert.ok(
    data.grants
      .filter((g) => !g.demo)
      .every((g) => !g.confirmed && !g.deadline),
  );
});
test("separate seed instances do not share mutable task, checklist, or robot state", () => {
  const first = createDemoData();
  const next = createDemoData();
  first.tasks[0].comments.push({
    text: "edited",
    date: new Date().toISOString(),
    author: "Test",
  });
  first.onboarding.push("test");
  first.robot.purpose = "changed";
  assert.equal(next.tasks[0].comments.length, 0);
  assert.equal(next.onboarding.includes("test"), false);
  assert.notEqual(next.robot.purpose, "changed");
});
test("empty but complete teams are valid and optional dates and links may be blank", () => {
  const data = createDemoData();
  for (const collection of [
    "tasks",
    "events",
    "sponsors",
    "grants",
    "resources",
    "announcements",
    "pitNotes",
  ])
    data[collection] = [];
  assert.equal(validateData(data), true);
});
test("invalid top-level shapes and schema versions are rejected without throwing", () => {
  for (const input of [
    null,
    undefined,
    42,
    "text",
    [],
    {},
    { schemaVersion: 2 },
    changed((d) => {
      d.tasks = null;
    }),
  ])
    assert.doesNotThrow(() => assert.equal(validateData(input), false));
});
test("missing display fields and malformed enum values cannot enter page components", () => {
  for (const mutate of [
    (d) => delete d.tasks[0].owner,
    (d) => (d.tasks[0].priority = "Urgent"),
    (d) => delete d.tasks[0].description,
    (d) => (d.events[0].type = "Invalid"),
    (d) => delete d.resources[0].kind,
    (d) => (d.grants[0].status = "Fake"),
    (d) => delete d.sponsors[0].contact,
    (d) => delete d.announcements[0].author,
  ])
    assert.equal(validateData(changed(mutate)), false);
});
test("malformed nested records and arrays are rejected without null dereference crashes", () => {
  for (const mutate of [
    (d) => (d.tasks[0].comments = [null]),
    (d) => (d.tasks[0].comments = [{ text: "note" }]),
    (d) => (d.sponsors[0].history = [null]),
    (d) => (d.grants[0].steps = [null]),
    (d) => (d.pitNotes = [null]),
    (d) => (d.resources[0].tags = [{}]),
    (d) => (d.tasks[0].dependencies = [null]),
    (d) => (d.onboarding = [{}]),
    (d) => (d.robot = []),
  ])
    assert.doesNotThrow(() =>
      assert.equal(validateData(changed(mutate)), false),
    );
});
test("records cannot cross team or season boundaries and IDs stay unique", () => {
  for (const mutate of [
    (d) => (d.tasks[0].teamId = "someone-else"),
    (d) => (d.grants[0].seasonId = "another-season"),
    (d) => d.events.push({ ...d.events[0] }),
    (d) => (d.tasks[0].id = ""),
    (d) => d.grants[0].steps.push({ ...d.grants[0].steps[0] }),
  ])
    assert.equal(validateData(changed(mutate)), false);
});
test("bad dates, impossible calendar dates, and times cannot crash event views", () => {
  for (const value of [
    "2026-13-01",
    "2026-02-30",
    "2026-00-01",
    "2026-01-00",
    "not a date",
    "",
  ])
    assert.equal(
      validateData(changed((d) => (d.events[0].date = value))),
      false,
    );
  for (const value of ["24:00", "17:99", "noon"])
    assert.equal(
      validateData(changed((d) => (d.events[0].time = value))),
      false,
    );
  assert.equal(
    validateData(changed((d) => (d.events[0].date = "2028-02-29"))),
    true,
  );
  assert.equal(
    validateData(changed((d) => (d.events[0].date = "2026-02-29"))),
    false,
  );
});
test("visibility and approval are typed, not truthy values", () => {
  for (const mutate of [
    (d) => (d.resources[0].visibility = "everyone"),
    (d) => (d.resources[0].approved = "yes"),
    (d) => (d.grants[0].confirmed = "true"),
    (d) => (d.sponsors[0].contacted = 1),
    (d) => (d.events[0].rsvp = "false"),
  ])
    assert.equal(validateData(changed(mutate)), false);
});
test("external record links allow only HTTP(S), with no executable or local URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///private.txt",
    "https-not-a-url",
  ])
    for (const mutate of [
      (d) => (d.resources[0].url = url),
      (d) => (d.grants[0].source = url),
      (d) => (d.sponsors[0].website = url),
      (d) => (d.robot.code = url),
    ])
      assert.equal(validateData(changed(mutate)), false);
  assert.equal(
    validateData(
      changed(
        (d) => (d.resources[0].url = "https://example.org/guide?q=robot"),
      ),
    ),
    true,
  );
});
test("ISO-timestamped comments, pit notes, and dated contact history round-trip", () => {
  const data = changed((d) => {
    d.tasks[0].comments = [
      {
        text: "Tested intake",
        date: new Date().toISOString(),
        author: "Alex (you)",
      },
    ];
    d.pitNotes = [
      {
        id: "note-1",
        text: "Match 1: inspect wheel",
        date: new Date().toISOString(),
      },
    ];
    d.sponsors[0].history = [
      { date: "2026-10-31", text: "Contacted by coach" },
    ];
  });
  assert.equal(validateData(data), true);
});
test("local repository persists complete user changes and returns fresh parsed objects", () => {
  storage();
  const data = changed((d) => (d.tasks[0].title = "Our actual intake test"));
  localRepository.write(data);
  const read = localRepository.read();
  assert.deepEqual(read, JSON.parse(JSON.stringify(data)));
  read.tasks[0].title = "unsaved";
  assert.equal(localRepository.read().tasks[0].title, "Our actual intake test");
});
test("invalid JSON and malformed saved state remain byte-for-byte intact after a failed write", () => {
  for (const raw of [
    "{broken-json",
    JSON.stringify({ schemaVersion: 1, tasks: [null] }),
    "",
  ]) {
    const disk = storage({ [STORAGE_KEY]: raw });
    assert.throws(() => localRepository.read());
    assert.throws(
      () => localRepository.write(createDemoData()),
      RecoveryRequiredError,
    );
    assert.equal(disk.getItem(STORAGE_KEY), raw);
    assert.equal(localRepository.readRaw(), raw);
  }
});
test("invalid in-memory changes never replace the last valid saved workspace", () => {
  const original = JSON.stringify(createDemoData());
  const disk = storage({ [STORAGE_KEY]: original });
  assert.throws(() =>
    localRepository.write(changed((d) => (d.tasks[0].owner = null))),
  );
  assert.equal(disk.getItem(STORAGE_KEY), original);
});
test("explicit recovery preserves the original text before replacing the workspace", () => {
  const raw = "{unreadable previous student work";
  const disk = storage({ [STORAGE_KEY]: raw });
  const restored = createDemoData();
  localRepository.recover(restored);
  assert.equal(disk.getItem(RECOVERY_KEY), raw);
  assert.deepEqual(
    localRepository.read(),
    JSON.parse(JSON.stringify(restored)),
  );
});
test("quota errors during recovery preserve the only original copy", () => {
  const raw = "broken";
  const disk = storage({ [STORAGE_KEY]: raw });
  const originalSet = disk.setItem;
  disk.setItem = (key, value) => {
    if (key === RECOVERY_KEY)
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    return originalSet(key, value);
  };
  assert.throws(() => localRepository.recover(createDemoData()), /Quota/);
  assert.equal(disk.getItem(STORAGE_KEY), raw);
});
test("an invalid recovery payload cannot overwrite even corrupt original data", () => {
  const disk = storage({ [STORAGE_KEY]: "broken" });
  assert.throws(() => localRepository.recover({}));
  assert.equal(disk.getItem(STORAGE_KEY), "broken");
  assert.equal(disk.getItem(RECOVERY_KEY), null);
});
