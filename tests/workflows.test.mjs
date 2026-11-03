import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { createServer } from "vite-legacy";

// These tests exercise real React components and context mutations without a browser.
// They deliberately do not claim to verify layout, focus behavior, or actual device input.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Map();
const on = (name, handler) => {
  const handlers = listeners.get(name) || new Set();
  handlers.add(handler);
  listeners.set(name, handlers);
};
const off = (name, handler) => listeners.get(name)?.delete(handler);
const location = { hash: "#home" };
const media = () => ({
  matches: false,
  media: "",
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});
Object.defineProperties(globalThis, {
  location: { value: location, configurable: true },
  matchMedia: { value: media, configurable: true },
  window: {
    value: {
      location,
      addEventListener: on,
      removeEventListener: off,
      scrollTo() {},
      matchMedia: media,
    },
    configurable: true,
  },
  document: {
    value: {
      body: { style: { overflow: "" } },
      activeElement: { focus() {} },
      addEventListener: on,
      removeEventListener: off,
      getElementById: () => ({ scrollIntoView() {} }),
      createElement: () => ({ href: "", download: "", click() {} }),
    },
    configurable: true,
  },
  navigator: {
    value: { onLine: true, clipboard: { writeText: async () => {} } },
    configurable: true,
  },
});
const server = await createServer({
  configFile: false,
  esbuild: { jsx: "automatic" },
  root: fileURLToPath(new URL("..", import.meta.url)),
  logLevel: "silent",
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: "custom",
});
after(async () => {
  await server.close();
});
const { HQProvider, useHQ } = await server.ssrLoadModule("/src/store.tsx");
const { createDemoData } = await server.ssrLoadModule("/src/seed.ts");
const { validateData, localRepository, STORAGE_KEY } =
  await server.ssrLoadModule("/src/persistence.ts");
const pageNames = [
  "Home",
  "Tasks",
  "Calendar",
  "Sponsors",
  "Grants",
  "Resources",
  "Onboarding",
  "Pit",
  "Settings",
  "Evidence",
  "Opportunities",
];
const pages = Object.fromEntries(
  await Promise.all(
    pageNames.map(async (name) => [
      name,
      (await server.ssrLoadModule(`/src/screens/${name}.tsx`)).default,
    ]),
  ),
);
const { Workspace } = await server.ssrLoadModule("/src/App.tsx");
const { default: AwardTracker } = await server.ssrLoadModule("/src/components/AwardTracker.tsx");

test("competition map opens real team records and requests location only after a click", async () => {
  const initial = createDemoData();
  Object.assign(initial.events[0], {demo:false,type:"Competition",title:"Mapped team qualifier",date:"2040-01-01",latitude:39.75,longitude:-75.59});
  let calls = 0;
  navigator.geolocation = {getCurrentPosition(_success, failure) { calls++; failure({code:1}); }};
  try {
    await fixture({initial,page:pages.Calendar}, async app => {
      await app.update(()=>byText(app.root,"button","Map").props.onClick());
      assert.equal(calls,0);
      const result = app.root.findAllByType("button").find(b=>b.findAllByType("strong").some(s=>s.children.includes("Mapped team qualifier")));
      assert.ok(result);
      await app.update(()=>result.props.onClick());
      assert.match(app.text,/Selected competition/);
      await app.update(()=>byText(app.root,"button","Use my location").props.onClick());
      assert.equal(calls,1);
      assert.match(app.text,/Location permission was declined/);
      assert.equal(app.context.data.latitude,undefined);
      await app.update(()=>byText(app.root,"button","Open team event").props.onClick());
      assert.ok(app.root.findAllByProps({role:"dialog"}).length);
      assert.match(app.text,/Mapped team qualifier/);
    });
  } finally { delete navigator.geolocation; }
});

test("competition coordinate fields enforce paired valid values and persist through the event form", async () => {
  await fixture({page:pages.Calendar}, async app => {
    await app.update(()=>byText(app.root,"button","New event").props.onClick());
    await app.update(()=>fieldControl(app.root,"Event title").props.onChange({target:{value:"Venue coordinate round trip"}}));
    await app.update(()=>fieldControl(app.root,"Venue latitude").props.onChange({target:{value:"39.75"}}));
    await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
    assert.equal(app.context.data.events.some(e=>e.title==="Venue coordinate round trip"),false);
    await app.update(()=>fieldControl(app.root,"Venue longitude").props.onChange({target:{value:"-75.59"}}));
    await app.update(()=>app.root.findByType("form").props.onSubmit({preventDefault(){}}));
    const event = app.context.data.events.find(e=>e.title==="Venue coordinate round trip");
    assert.equal(event.latitude,39.75); assert.equal(event.longitude,-75.59);
    assert.equal(validateData(JSON.parse(localStorage.getItem(STORAGE_KEY))),true);
  });
});
const { FocusSession } = await server.ssrLoadModule(
  "/src/components/FocusSession.tsx",
);

function memoryStorage(initial) {
  const values = new Map(
    initial ? [[STORAGE_KEY, JSON.stringify(initial)]] : [],
  );
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return storage;
}
async function mount({ initial = createDemoData(), page, role = "lead" } = {}) {
  memoryStorage(initial);
  location.hash = "#home";
  let current, renderer;
  function Probe() {
    current = useHQ();
    return page ? React.createElement(page) : null;
  }
  // React 19 deprecates this renderer; filter only that expected one-time warning.
  const previousError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].startsWith("react-test-renderer is deprecated.")
    )
      return;
    previousError(...args);
  };
  try {
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(HQProvider, null, React.createElement(Probe)),
      );
    });
  } finally {
    console.error = previousError;
  }
  if (role !== "lead")
    await act(async () => {
      current.setRole(role);
    });
  return {
    get context() {
      return current;
    },
    get root() {
      return renderer.root;
    },
    get text() {
      return JSON.stringify(renderer.toJSON());
    },
    async update(callback) {
      await act(async () => {
        await callback(current);
      });
    },
    async close() {
      await act(async () => renderer.unmount());
    },
  };
}
async function fixture(options, callback) {
  const app = await mount(options);
  try {
    await callback(app);
  } finally {
    await app.close();
  }
}
const copy = (value) => JSON.parse(JSON.stringify(value));
const ownTask = (data) => data.tasks.find((t) => t.owner === "Alex (you)");
const otherTask = (data) => data.tasks.find((t) => t.owner !== "Alex (you)");
const byText = (root, type, text) =>
  root
    .findAllByType(type)
    .find((node) =>
      node.children.some(
        (child) => typeof child === "string" && child.trim() === text,
      ),
    );
function fieldControl(root, label, type = "input") {
  const field = root
    .findAll(
      (node) => node.type === "label" && node.props.className === "field",
    )
    .find((node) =>
      node.findAllByType("span").some((span) => span.children.includes(label)),
    );
  assert.ok(field, `Field “${label}” should be rendered`);
  return field.findByType(type);
}

test("award progress saves to the team task data and respects ownership", async () => {
  await fixture({page:AwardTracker}, async app => {
    assert.equal(app.root.findAllByType("details").length,8);
    await app.update(()=>app.root.findAllByType("select")[0].props.onChange({target:{value:"Done"}}));
    const task=app.context.data.tasks.find(t=>t.id==="award-biobuzz-inspire-r1");
    assert.equal(task.status,"Done");
    assert.equal(task.due,"");
    assert.equal(task.area,"Awards");
    assert.equal(validateData(JSON.parse(localStorage.getItem(STORAGE_KEY))),true);
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).tasks.find(t=>t.id===task.id).status,"Done");
    assert.equal(app.root.findAllByType("summary")[0].findByType("small").children.join(""),"1 of 4 required items marked done");
  });
  const initial=createDemoData();
  initial.tasks.push({id:"award-biobuzz-inspire-r1",teamId:initial.teamId,seasonId:initial.seasonId,title:"Award task",owner:"Another member",area:"Awards",due:"",priority:"Medium",status:"In progress",done:"",effort:"",description:"",dependencies:[],comments:[]});
  await fixture({initial,page:AwardTracker,role:"student"}, async app => {
    assert.equal(app.root.findAllByType("select")[0].props.disabled,true);
    assert.match(app.text,/Ask the owner or a team lead to update it/);
  });
});

test("workspace tabs, exact-record search, and role changes keep the redesigned shell connected", async () => {
  const initial = createDemoData();
  initial.sponsors[0].name = "PRIVATE SHELL SPONSOR SENTINEL";
  await fixture({ initial, page: Workspace }, async (app) => {
    const mainNavigation = () =>
      app.root.findByProps({ className: "workspace-tabs" });
    const tab = (label) => byText(mainNavigation(), "button", label);
    assert.equal(mainNavigation().type, "nav");
    assert.equal(mainNavigation().props["aria-label"], "Main navigation");
    assert.equal(app.root.findAllByProps({className:"workspace-sidebar"}).length,1,"The redesigned workspace uses persistent sidebar navigation");

    await app.update(() => tab("Tasks").props.onClick());
    assert.equal(app.context.page, "tasks");
    assert.equal(tab("Tasks").props["aria-current"], "page");
    assert.ok(byText(app.root, "h1", "Tasks"));
    await app.update(() => tab("Schedule").props.onClick());
    assert.equal(app.context.page, "calendar");
    assert.equal(tab("Schedule").props["aria-current"], "page");
    assert.ok(byText(app.root, "h1", "Schedule"));

    const task = ownTask(app.context.data);
    await app.update(() =>
      app.root
        .findByProps({ "aria-label": "Search Ctrl K — search workspace" })
        .props.onClick(),
    );
    await app.update(() =>
      app.root
        .findByProps({ "aria-label": "Search workspace" })
        .props.onChange({ target: { value: task.title } }),
    );
    const searchDialog = app.root.findByProps({ role: "dialog" });
    const result = searchDialog
      .findAllByType("button")
      .find((button) =>
        button
          .findAllByType("span")
          .some((span) => span.children.includes(task.title)),
      );
    assert.ok(result, "Search should offer the matching task");
    await app.update(() => result.props.onClick());
    assert.equal(app.context.page, "tasks");
    assert.equal(fieldControl(app.root, "Task name").props.value, task.title);
    assert.equal(app.context.focusRecord, null);

    await app.update(() =>
      app.root.findByProps({ "aria-label": "Close dialog" }).props.onClick(),
    );
    assert.equal(app.root.findAllByProps({ role: "dialog" }).length, 0);
    await app.update(() =>
      app.root
        .findByProps({ "aria-label": "Demo permission preview" })
        .props.onChange({ target: { value: "student" } }),
    );
    await app.update(() => tab("Outreach").props.onClick());
    assert.equal(app.context.role, "student");
    assert.equal(app.context.page, "sponsors");
    assert.ok(byText(app.root, "h2", "Restricted records"));
    assert.doesNotMatch(app.text, /PRIVATE SHELL SPONSOR SENTINEL/);
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("a lead creates an actual task through the form, completes it, and reloads the saved result", async () => {
  let saved;
  await fixture({ page: pages.Tasks }, async (app) => {
    await app.update(() =>
      byText(app.root, "button", "New task").props.onClick(),
    );
    await app.update(() =>
      fieldControl(app.root, "Task name").props.onChange({
        target: { value: "Run a repeatable intake test" },
      }),
    );
    await app.update(() =>
      fieldControl(
        app.root,
        "What does done look like?",
        "textarea",
      ).props.onChange({
        target: { value: "Ten runs recorded in the shared build log." },
      }),
    );
    await app.update(() =>
      app.root.findAllByType("form")[0].props.onSubmit({ preventDefault() {} }),
    );
    const task = app.context.data.tasks.find(
      (t) => t.title === "Run a repeatable intake test",
    );
    assert.ok(task);
    assert.equal(task.demo, false);
    assert.equal(task.owner, "Alex (you)");
    assert.equal(task.done, "Ten runs recorded in the shared build log.");
    const status = app.root
      .findAllByType("select")
      .find((s) => s.props["aria-label"] === `Status for ${task.title}`);
    assert.ok(status);
    await app.update(() =>
      status.props.onChange({ target: { value: "Done" } }),
    );
    assert.equal(
      app.context.data.tasks.find((t) => t.id === task.id).status,
      "Done",
    );
    saved = localRepository.read();
    assert.equal(validateData(saved), true);
  });
  await fixture({ initial: saved }, async (app) =>
    assert.equal(
      app.context.data.tasks.find(
        (t) => t.title === "Run a repeatable intake test",
      ).status,
      "Done",
    ),
  );
});

test("students can update their tasks and RSVP, while other ownership and event changes are refused", async () => {
  await fixture({ role: "student" }, async (app) => {
    const mine = copy(ownTask(app.context.data)),
      other = copy(otherTask(app.context.data)),
      event = copy(app.context.data.events[0]);
    await app.update((ctx) =>
      ctx.saveRecord("tasks", { ...mine, status: "Done" }),
    );
    assert.equal(
      app.context.data.tasks.find((t) => t.id === mine.id).status,
      "Done",
    );
    await app.update((ctx) =>
      ctx.saveRecord("tasks", { ...other, title: "Unauthorized edit" }),
    );
    assert.deepEqual(
      app.context.data.tasks.find((t) => t.id === other.id),
      other,
    );
    assert.match(app.context.notice.message, /student lead|assigned/i);
    await app.update((ctx) =>
      ctx.saveRecord("tasks", {
        ...other,
        owner: "Alex (you)",
        status: "Done",
      }),
    );
    assert.deepEqual(
      app.context.data.tasks.find((t) => t.id === other.id),
      other,
    );
    await app.update((ctx) =>
      ctx.saveRecord("sponsors", {
        ...ctx.data.sponsors[0],
        contacted: true,
        notes: "Unauthorized notes",
      }),
    );
    assert.notEqual(app.context.data.sponsors[0].notes, "Unauthorized notes");
    await app.update((ctx) =>
      ctx.saveRecord("events", { ...event, rsvp: true }),
    );
    assert.equal(
      app.context.data.events.find((e) => e.id === event.id).rsvp,
      true,
    );
    await app.update((ctx) =>
      ctx.saveRecord("events", {
        ...ctx.data.events.find((e) => e.id === event.id),
        title: "Unauthorized event edit",
        rsvp: false,
      }),
    );
    assert.equal(
      app.context.data.events.find((e) => e.id === event.id).title,
      event.title,
    );
    assert.equal(
      app.context.data.events.find((e) => e.id === event.id).rsvp,
      true,
    );
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("lead approval attempts are blocked and a mentor can approve drafts and public-use resources", async () => {
  await fixture({}, async (app) => {
    const sponsor = copy(app.context.data.sponsors[0]);
    const resource = {
      ...copy(app.context.data.resources[0]),
      id: "review-resource",
      title: "Team-approved robot close-up",
      visibility: "public",
      approved: false,
      demo: false,
    };
    await app.update((ctx) => ctx.saveRecord("resources", resource));
    await app.update((ctx) =>
      ctx.saveRecord("resources", { ...resource, approved: true }),
    );
    assert.equal(
      app.context.data.resources.find((r) => r.id === resource.id).approved,
      false,
    );
    assert.match(app.context.notice.message, /mentor|admin/i);
    await app.update((ctx) =>
      ctx.saveRecord("sponsors", { ...sponsor, draftStatus: "Approved" }),
    );
    assert.equal(
      app.context.data.sponsors.find((s) => s.id === sponsor.id).draftStatus,
      "Draft",
    );
    await app.update((ctx) => ctx.setRole("mentor"));
    await app.update((ctx) =>
      ctx.saveRecord("resources", { ...resource, approved: true }),
    );
    await app.update((ctx) =>
      ctx.saveRecord("sponsors", { ...sponsor, draftStatus: "Approved" }),
    );
    assert.equal(
      app.context.data.resources.find((r) => r.id === resource.id).approved,
      true,
    );
    assert.equal(
      app.context.data.sponsors.find((s) => s.id === sponsor.id).draftStatus,
      "Approved",
    );
    await app.update((ctx) => ctx.setRole("lead"));
    await app.update((ctx) =>
      ctx.saveRecord("sponsors", {
        ...ctx.data.sponsors.find((s) => s.id === sponsor.id),
        draft: "A changed message must be reviewed again.",
      }),
    );
    assert.equal(
      app.context.data.sponsors.find((s) => s.id === sponsor.id).draft,
      sponsor.draft,
    );
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("new tasks, competitions, sponsor follow-ups, and submitted grants survive CRUD and JSON round trips", async () => {
  await fixture({}, async (app) => {
    const source = app.context.data;
    const records = {
      tasks: {
        ...copy(source.tasks[0]),
        id: "integration-task",
        demo: false,
        title: "Student-created build task",
        status: "To do",
        comments: [],
      },
      events: {
        ...copy(source.events[0]),
        id: "integration-event",
        demo: false,
        title: "Team competition",
        type: "Competition",
        date: "2026-11-14",
        time: "09:00",
        endTime: "16:00",
        source: "Manually entered by team",
      },
      sponsors: {
        ...copy(source.sponsors[0]),
        id: "integration-sponsor",
        demo: false,
        name: "Team-entered prospect",
        contacted: false,
        status: "Researching",
        followUp: "2026-11-07",
        source: "https://example.org/about",
        website: "https://example.org",
        history: [],
      },
      grants: {
        ...copy(source.grants[0]),
        id: "integration-grant",
        demo: false,
        name: "Team-entered funding application",
        source: "https://example.org/funding",
        deadline: "2026-11-21",
        internalDeadline: "2026-11-14",
        eligibility:
          "Confirm the published FTC and Delaware requirements with this funder.",
        confirmed: false,
        status: "In Progress",
        steps: [
          {
            id: "integration-step",
            title: "Coach reviews application",
            done: false,
          },
        ],
      },
    };
    for (const [collection, record] of Object.entries(records))
      await app.update((ctx) => ctx.saveRecord(collection, record));
    for (const [collection, record] of Object.entries(records))
      assert.ok(
        app.context.data[collection].some((item) => item.id === record.id),
      );
    await app.update((ctx) =>
      ctx.saveRecord("sponsors", {
        ...ctx.data.sponsors.find((s) => s.id === "integration-sponsor"),
        contacted: true,
        status: "Contacted",
        history: [
          {
            date: "2026-10-31",
            text: "Coach sent the approved introduction manually.",
          },
        ],
      }),
    );
    await app.update((ctx) =>
      ctx.saveRecord("grants", {
        ...ctx.data.grants.find((g) => g.id === "integration-grant"),
        status: "Submitted",
        steps: [
          {
            id: "integration-step",
            title: "Coach reviews application",
            done: true,
          },
        ],
      }),
    );
    const saved = localRepository.read();
    assert.equal(validateData(saved), true);
    assert.deepEqual(saved, copy(app.context.data));
    assert.equal(
      saved.sponsors.find((s) => s.id === "integration-sponsor").contacted,
      true,
    );
    assert.equal(
      saved.grants.find((g) => g.id === "integration-grant").status,
      "Submitted",
    );
    for (const [collection, record] of Object.entries(records)) {
      await app.update((ctx) => ctx.removeRecord(collection, record.id));
      assert.equal(
        app.context.data[collection].some((item) => item.id === record.id),
        false,
      );
      const undo = app.context.notice.action;
      assert.equal(typeof undo, "function");
      await app.update(() => undo());
      assert.equal(
        app.context.data[collection].filter((item) => item.id === record.id)
          .length,
        1,
      );
    }
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("records from a different team or season never enter the active workspace", async () => {
  await fixture({}, async (app) => {
    for (const boundary of [
      { teamId: "another-team" },
      { seasonId: "another-season" },
    ]) {
      const record = {
        ...copy(app.context.data.tasks[0]),
        ...boundary,
        id: "cross-boundary",
      };
      await app.update((ctx) => ctx.saveRecord("tasks", record));
      assert.equal(
        app.context.data.tasks.some((t) => t.id === record.id),
        false,
      );
      assert.match(app.context.notice.message, /another team or season/i);
    }
  });
});

test("the calendar opens with upcoming dates across months and keeps past dates in the season view", async () => {
  const initial = createDemoData();
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const key = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  initial.events = [
    { ...copy(initial.events[0]), id: "future-month", title: "Next month team planning", date: key(nextMonth) },
    { ...copy(initial.events[0]), id: "past-build", title: "Past build archive", date: key(yesterday) },
  ];
  await fixture({ initial, page: pages.Calendar }, async (app) => {
    assert.equal(byText(app.root, "button", "Agenda").props.className, "active");
    assert.match(app.text, /Upcoming events/);
    assert.match(app.text, /Next month team planning/);
    assert.doesNotMatch(app.text, /Past build archive/);
    assert.equal(
      app.root.findAllByType("time").find((node) => node.props.dateTime === key(nextMonth))?.props["aria-label"],
      nextMonth.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    );
    await app.update(() => byText(app.root, "button", "Season").props.onClick());
    assert.match(app.text, /Past build archive/);
  });
});

test("old sample instructions are refreshed without replacing edited or real task content", async () => {
  const initial = createDemoData();
  const generic = "Share the result at the next build meeting and add a short note to the build log.";
  initial.tasks[0].done = generic;
  initial.tasks[0].description = "Work with a teammate. Ask a mentor if you need help or a safety check.";
  initial.tasks[1].done = "Review our actual autonomous spreadsheet.";
  initial.tasks[1].description = "Keep these notes from our team.";
  initial.tasks[2].demo = false;
  initial.tasks[2].done = generic;
  await fixture({ initial }, async (app) => {
    assert.match(app.context.data.tasks[0].done, /intake run/);
    assert.match(app.context.data.tasks[0].description, /first three runs/);
    assert.equal(app.context.data.tasks[1].done, initial.tasks[1].done);
    assert.equal(app.context.data.tasks[1].description, initial.tasks[1].description);
    assert.equal(app.context.data.tasks[2].done, generic);
    assert.equal(localRepository.read().tasks[0].done, app.context.data.tasks[0].done);
  });
});

test("the actual calendar form adds a competition to agenda and season views", async () => {
  await fixture({ page: pages.Calendar }, async (app) => {
    await app.update(() =>
      byText(app.root, "button", "New event").props.onClick(),
    );
    await app.update(() =>
      fieldControl(app.root, "Event title").props.onChange({
        target: { value: "Our team practice competition" },
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Event type", "select").props.onChange({
        target: { value: "Competition" },
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Date").props.onChange({
        target: { value: "2026-11-14" },
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Location").props.onChange({
        target: { value: "Team workshop" },
      }),
    );
    await app.update(() =>
      app.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    assert.ok(
      app.context.data.events.find(
        (e) =>
          e.title === "Our team practice competition" &&
          e.type === "Competition",
      ),
    );
    await app.update(() =>
      byText(app.root, "button", "Agenda").props.onClick(),
    );
    assert.match(app.text, /Our team practice competition/);
    await app.update(() =>
      byText(app.root, "button", "Season").props.onClick(),
    );
    assert.match(app.text, /Our team practice competition/);
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("a lead adds a sponsor, marks it contacted, and finds an overdue follow-up through the real controls", async () => {
  await fixture({ page: pages.Sponsors }, async (app) => {
    await app.update(() =>
      byText(app.root, "button", "Add sponsor").props.onClick(),
    );
    await app.update(() =>
      fieldControl(app.root, "Organization name").props.onChange({
        target: { value: "Our team-entered sponsor prospect" },
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Source URL").props.onChange({
        target: { value: "https://example.org/community" },
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Next follow-up").props.onChange({
        target: { value: "2026-10-01" },
      }),
    );
    await app.update(() =>
      app.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    let sponsor = app.context.data.sponsors.find(
      (s) => s.name === "Our team-entered sponsor prospect",
    );
    assert.ok(sponsor);
    assert.equal(sponsor.demo, false);
    assert.equal(sponsor.visibility, "private");
    assert.equal(sponsor.contacted, false);
    const contacted = app.root
      .findAllByType("button")
      .find((b) => b.props["data-contact-sponsor"] === sponsor.id);
    await app.update(() => contacted.props.onClick());
    sponsor = app.context.data.sponsors.find((s) => s.id === sponsor.id);
    assert.equal(sponsor.contacted, true);
    assert.equal(sponsor.status, "Contacted");
    assert.equal(sponsor.followUp, "2026-10-01");
    assert.ok(sponsor.history.some((h) => h.text.includes("contacted")));
    const followUpFilter = app.root
      .findAllByType("button")
      .find((b) => b.props.className?.includes("funding-stat-button"));
    await app.update(() => followUpFilter.props.onClick());
    assert.match(app.text, /Our team-entered sponsor prospect/);
    assert.equal(
      app.root
        .findAllByType("button")
        .find((b) => b.props.className?.includes("funding-stat-button")).props[
        "aria-pressed"
      ],
      true,
    );
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("a lead records a grant source, eligibility, deadline, owner, checklist step, and manual submission through the form", async () => {
  await fixture({ page: pages.Grants }, async (app) => {
    await app.update(() =>
      byText(app.root, "button", "Add opportunity").props.onClick(),
    );
    const fields = [
      ["Opportunity / funder name", "Our team-entered application"],
      ["Official funder / source URL", "https://example.org/funding"],
      ["Official application deadline", "2026-11-21"],
      ["Team’s internal deadline", "2026-11-14"],
      ["Assigned owner", "Jordan"],
    ];
    for (const [label, value] of fields)
      await app.update(() =>
        fieldControl(app.root, label).props.onChange({ target: { value } }),
      );
    await app.update(() =>
      fieldControl(app.root, "Eligibility summary", "textarea").props.onChange({
        target: {
          value:
            "Verify FIRST Tech Challenge and Delaware team eligibility with the funder.",
        },
      }),
    );
    await app.update(() =>
      app.root
        .findAllByType("input")
        .find((i) => i.props["aria-label"] === "New application step")
        .props.onChange({
          target: { value: "Jordan prepares the team project summary" },
        }),
    );
    await app.update(() =>
      byText(app.root, "button", "Add step").props.onClick(),
    );
    await app.update(() =>
      byText(app.root, "button", "Mark submitted").props.onClick(),
    );
    await app.update(() =>
      app.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    const grant = app.context.data.grants.find(
      (g) => g.name === "Our team-entered application",
    );
    assert.ok(grant);
    assert.equal(grant.source, "https://example.org/funding");
    assert.equal(grant.deadline, "2026-11-21");
    assert.equal(grant.owner, "Jordan");
    assert.equal(grant.confirmed, false);
    assert.equal(grant.status, "Submitted");
    assert.ok(
      grant.steps.some(
        (s) => s.title === "Jordan prepares the team project summary",
      ),
    );
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("the task completion control explains an unfinished dependency before allowing completion", async () => {
  const initial = createDemoData();
  initial.tasks[0].dependencies = [initial.tasks[1].id];
  await fixture({ initial, page: pages.Tasks }, async (app) => {
    const target = app.context.data.tasks[0];
    const complete = () =>
      app.root
        .findAllByType("select")
        .find((s) => s.props["aria-label"] === `Status for ${target.title}`)
        .props.onChange({ target: { value: "Done" } });
    await app.update(complete);
    assert.equal(
      app.context.data.tasks.find((t) => t.id === target.id).status,
      "In progress",
    );
    assert.match(app.context.notice.message, /dependencies/i);
    await app.update((ctx) =>
      ctx.saveRecord("tasks", {
        ...ctx.data.tasks.find((t) => t.id === target.dependencies[0]),
        status: "Done",
      }),
    );
    await app.update(complete);
    assert.equal(
      app.context.data.tasks.find((t) => t.id === target.id).status,
      "Done",
    );
  });
});

test("record navigation opens the exact task or calendar event and preserves student edit permissions", async () => {
  const initial = createDemoData();
  initial.resources.push({
    ...copy(initial.resources[0]),
    id: "private-picker-resource",
    title: "PRIVATE PICKER SENTINEL",
    visibility: "private",
  });
  initial.resources.push({
    ...copy(initial.resources[0]),
    id: "unapproved-picker-resource",
    title: "UNAPPROVED PICKER SENTINEL",
    visibility: "team",
    approved: false,
  });
  await fixture(
    { initial, page: pages.Tasks, role: "student" },
    async (app) => {
      const task = otherTask(app.context.data);
      await app.update((ctx) => ctx.openRecord("tasks", task.id));
      assert.equal(app.context.page, "tasks");
      assert.equal(app.context.focusRecord, null);
      assert.equal(fieldControl(app.root, "Task name").props.value, task.title);
      assert.equal(fieldControl(app.root, "Task name").props.disabled, true);
      const mine = ownTask(app.context.data);
      await app.update((ctx) => ctx.openRecord("tasks", mine.id));
      assert.equal(fieldControl(app.root, "Task name").props.value, mine.title);
      assert.equal(fieldControl(app.root, "Task name").props.disabled, false);
      assert.equal(app.context.focusRecord, null);
      assert.doesNotMatch(
        app.text,
        /PRIVATE PICKER SENTINEL|UNAPPROVED PICKER SENTINEL/,
      );
      if (mine.resourceId) {
        await app.update(() =>
          byText(app.root, "button", "Open linked resource").props.onClick(),
        );
        assert.equal(app.context.page, "resources");
        assert.deepEqual(app.context.focusRecord, {
          page: "resources",
          id: mine.resourceId,
        });
      }
    },
  );
  await fixture({ page: pages.Calendar, role: "student" }, async (app) => {
    const event = app.context.data.events.find((e) => e.type === "Competition");
    await app.update((ctx) => ctx.openRecord("calendar", event.id));
    assert.equal(app.context.page, "calendar");
    assert.equal(app.context.focusRecord, null);
    const dialog = app.root.findByProps({ role: "dialog" });
    assert.ok(
      dialog.findAllByType("h2").some((h) => h.children.includes(event.title)),
    );
    assert.equal(byText(dialog, "button", "Edit event"), undefined);
    assert.ok(byText(dialog, "button", "I’m going"));
  });
});

test("every core page renders with the real seeded store in student and lead previews", async () => {
  for (const role of ["student", "lead"])
    for (const [name, page] of Object.entries(pages)) {
      await fixture({ page, role }, async (app) => {
        assert.ok(
          app.root.findAllByType("h1").length,
          `${name} (${role}) should have a page heading`,
        );
        assert.equal(validateData(app.context.data), true);
        assert.equal(app.context.storageError, "");
      });
    }
});

test("student page rendering does not disclose private sponsors, grants, or resources", async () => {
  const initial = createDemoData();
  initial.sponsors[0] = {
    ...initial.sponsors[0],
    name: "PRIVATE SPONSOR SENTINEL",
    contact: "PRIVATE CONTACT SENTINEL",
    notes: "PRIVATE OUTREACH SENTINEL",
    visibility: "private",
  };
  initial.grants[0] = {
    ...initial.grants[0],
    name: "PRIVATE GRANT SENTINEL",
    eligibility: "PRIVATE FINANCE SENTINEL",
    visibility: "private",
  };
  initial.resources[0] = {
    ...initial.resources[0],
    title: "PRIVATE RESOURCE SENTINEL",
    content: "PRIVATE DOCUMENT SENTINEL",
    visibility: "private",
    approved: true,
  };
  initial.resources[1] = {
    ...initial.resources[1],
    title: "UNAPPROVED RESOURCE SENTINEL",
    content: "UNAPPROVED NOTES SENTINEL",
    visibility: "team",
    approved: false,
  };
  for (const name of ["Sponsors", "Grants", "Resources", "Home"])
    await fixture(
      { initial, page: pages[name], role: "student" },
      async (app) => {
        assert.doesNotMatch(
          app.text,
          /PRIVATE (?:SPONSOR|CONTACT|OUTREACH|GRANT|FINANCE|RESOURCE|DOCUMENT) SENTINEL/,
        );
        assert.doesNotMatch(app.text, /UNAPPROVED (?:RESOURCE|NOTES) SENTINEL/);
      },
    );
});

test("an empty fresh workspace keeps all core pages usable", async () => {
  const initial = createDemoData();
  for (const name of [
    "tasks",
    "events",
    "sponsors",
    "grants",
    "resources",
    "announcements",
    "onboarding",
    "pitChecklist",
    "pitNotes",
    "skills",
  ])
    initial[name] = [];
  for (const [name, page] of Object.entries(pages))
    await fixture({ initial, page }, async (app) => {
      assert.ok(
        app.root.findAllByType("h1").length,
        `${name} should render an empty workspace`,
      );
      assert.equal(validateData(app.context.data), true);
      assert.equal(app.context.storageError, "");
    });
});

test("a build session logs real task notes without losing another teammate's update", async () => {
  const initial = createDemoData();
  const selected = ownTask(initial);
  const SessionPage = () =>
    React.createElement(FocusSession, { taskId: selected.id, onClose() {} });
  let saved;
  await fixture({ initial, page: SessionPage }, async (app) => {
    const beforeStatus = app.context.data.tasks.find(
      (t) => t.id === selected.id,
    ).status;
    assert.match(
      app.text,
      new RegExp(selected.done.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    await app.update(() =>
      fieldControl(app.root, "Build note", "textarea").props.onChange({
        target: {
          value:
            "Adjusted roller clearance. Ten test runs passed; recheck the left bracket next.",
        },
      }),
    );
    await app.update((ctx) => {
      const current = ctx.data.tasks.find((t) => t.id === selected.id);
      ctx.saveRecord("tasks", {
        ...current,
        comments: [
          ...current.comments,
          {
            text: "Teammate added the measurement sheet.",
            author: "Jordan",
            date: new Date().toISOString(),
          },
        ],
      });
    });
    await app.update(() =>
      app.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    const current = app.context.data.tasks.find((t) => t.id === selected.id);
    assert.equal(
      current.comments.at(-2).text,
      "Teammate added the measurement sheet.",
    );
    assert.match(current.comments.at(-1).text, /Ten test runs passed/);
    assert.equal(current.comments.at(-1).author, "Alex (you)");
    assert.equal(
      current.status,
      beforeStatus,
      "Saving a note does not complete the assignment",
    );
    assert.equal(
      fieldControl(app.root, "Build note", "textarea").props.value,
      "",
    );
    saved = localRepository.read();
    assert.equal(validateData(saved), true);
  });
  await fixture({ initial: saved, page: SessionPage }, async (app) => {
    assert.match(
      app.context.data.tasks.find((t) => t.id === selected.id).comments.at(-1)
        .text,
      /Ten test runs passed/,
    );
    assert.equal(
      app.root
        .findByProps({ "aria-label": "Time remaining" })
        .children.join(""),
      "20:00",
      "The optional timer is local to each session",
    );
  });
});

test("focus completion enforces dependencies and undo preserves newer build notes", async () => {
  const initial = createDemoData();
  const selected = ownTask(initial);
  const dependency = initial.tasks.find(
    (t) => t.id !== selected.id && t.status !== "Done",
  );
  selected.dependencies = [dependency.id];
  const SessionPage = () =>
    React.createElement(FocusSession, { taskId: selected.id, onClose() {} });
  await fixture({ initial, page: SessionPage }, async (app) => {
    await app.update(() =>
      byText(app.root, "button", "Finish task").props.onClick(),
    );
    assert.equal(
      app.context.data.tasks.find((t) => t.id === selected.id).status,
      selected.status,
    );
    assert.match(app.context.notice.message, /dependencies/i);
    await app.update((ctx) =>
      ctx.saveRecord("tasks", {
        ...ctx.data.tasks.find((t) => t.id === dependency.id),
        status: "Done",
      }),
    );
    await app.update(() =>
      fieldControl(app.root, "Build note", "textarea").props.onChange({
        target: { value: "Retested after the dependency was complete." },
      }),
    );
    await app.update(() =>
      byText(app.root, "button", "Save note & finish task").props.onClick(),
    );
    const finished = app.context.data.tasks.find((t) => t.id === selected.id);
    assert.equal(finished.status, "Done");
    assert.equal(
      finished.comments.at(-1).text,
      "Retested after the dependency was complete.",
    );
    const undo = app.context.notice.action;
    assert.equal(typeof undo, "function");
    await app.update((ctx) => {
      const current = ctx.data.tasks.find((t) => t.id === selected.id);
      ctx.saveRecord("tasks", {
        ...current,
        comments: [
          ...current.comments,
          {
            text: "Next teammate confirmed the result.",
            author: "Jordan",
            date: new Date().toISOString(),
          },
        ],
      });
    });
    await app.update(() => undo());
    const restored = app.context.data.tasks.find((t) => t.id === selected.id);
    assert.equal(restored.status, selected.status);
    assert.equal(
      restored.comments.at(-1).text,
      "Next teammate confirmed the result.",
    );
    assert.equal(
      restored.comments.at(-2).text,
      "Retested after the dependency was complete.",
    );
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("a student can view another assignment but cannot change it through a build session", async () => {
  const initial = createDemoData();
  const selected = otherTask(initial);
  const original = copy(selected);
  const SessionPage = () =>
    React.createElement(FocusSession, { taskId: selected.id, onClose() {} });
  await fixture(
    { initial, page: SessionPage, role: "student" },
    async (app) => {
      assert.equal(
        byText(app.root, "button", "Start focus timer").props.disabled,
        true,
      );
      assert.equal(
        byText(app.root, "button", "Finish task").props.disabled,
        true,
      );
      assert.equal(
        fieldControl(app.root, "Build note", "textarea").props.disabled,
        true,
      );
      // Invoke handlers directly as well as checking disabled controls: permissions live in the mutation path.
      await app.update(() =>
        byText(app.root, "button", "Start focus timer").props.onClick(),
      );
      await app.update(() =>
        fieldControl(app.root, "Build note", "textarea").props.onChange({
          target: { value: "Unauthorized build note" },
        }),
      );
      await app.update(() =>
        app.root.findByType("form").props.onSubmit({ preventDefault() {} }),
      );
      await app.update(() =>
        byText(app.root, "button", "Save note & finish task").props.onClick(),
      );
      assert.deepEqual(
        app.context.data.tasks.find((t) => t.id === selected.id),
        original,
      );
      assert.equal(
        app.root.findByProps({ "aria-label": "Time remaining" }).props[
          "data-running"
        ],
        false,
      );
    },
  );
});

test("focus timer start, pause, and reset preserve explicit task completion", async () => {
  const initial = createDemoData();
  const selected = initial.tasks.find(
    (t) => t.owner === "Alex (you)" && t.status === "To do",
  );
  const SessionPage = () =>
    React.createElement(FocusSession, { taskId: selected.id, onClose() {} });
  await fixture(
    { initial, page: SessionPage, role: "student" },
    async (app) => {
      await app.update(() =>
        app.root
          .findByProps({ "aria-label": "Focus duration" })
          .props.onChange({ target: { value: "10" } }),
      );
      assert.equal(
        app.root
          .findByProps({ "aria-label": "Time remaining" })
          .children.join(""),
        "10:00",
      );
      await app.update(() =>
        byText(app.root, "button", "Start focus timer").props.onClick(),
      );
      assert.equal(
        app.context.data.tasks.find((t) => t.id === selected.id).status,
        "In progress",
      );
      assert.equal(
        app.root.findByProps({ "aria-label": "Time remaining" }).props[
          "data-running"
        ],
        true,
      );
      assert.equal(
        app.root.findByProps({ "aria-label": "Focus duration" }).props.disabled,
        true,
      );
      await app.update(() =>
        byText(app.root, "button", "Pause timer").props.onClick(),
      );
      assert.equal(
        app.root.findByProps({ "aria-label": "Time remaining" }).props[
          "data-running"
        ],
        false,
      );
      await app.update(() =>
        byText(app.root, "button", "Reset timer").props.onClick(),
      );
      assert.equal(
        app.root
          .findByProps({ "aria-label": "Time remaining" })
          .children.join(""),
        "10:00",
      );
      assert.equal(
        app.context.data.tasks.find((t) => t.id === selected.id).status,
        "In progress",
        "Timer controls never mark the task done",
      );
      assert.equal(
        app.context.data.tasks.find((t) => t.id === selected.id).comments
          .length,
        selected.comments.length,
      );
    },
  );
});

test("closing a build session protects an unsaved note", async () => {
  const initial = createDemoData();
  const selected = ownTask(initial);
  let closes = 0;
  const SessionPage = () =>
    React.createElement(FocusSession, {
      taskId: selected.id,
      onClose() {
        closes++;
      },
    });
  await fixture({ initial, page: SessionPage }, async (app) => {
    await app.update(() =>
      fieldControl(app.root, "Build note", "textarea").props.onChange({
        target: { value: "Unsaved measurement" },
      }),
    );
    await app.update(() =>
      app.root.findByProps({ "aria-label": "Close dialog" }).props.onClick(),
    );
    assert.equal(closes, 0);
    assert.match(app.text, /Your build note has not been saved/);
    await app.update(() =>
      byText(app.root, "button", "Keep editing").props.onClick(),
    );
    assert.equal(
      fieldControl(app.root, "Build note", "textarea").props.value,
      "Unsaved measurement",
    );
    await app.update(() =>
      app.root.findByProps({ "aria-label": "Close dialog" }).props.onClick(),
    );
    await app.update(() =>
      byText(app.root, "button", "Discard note & close").props.onClick(),
    );
    assert.equal(closes, 1);
    assert.equal(
      app.context.data.tasks.find((t) => t.id === selected.id).comments.length,
      selected.comments.length,
    );
  });
});

test("workstream selection filters the queue, pins a real task, and opens its build session", async () => {
  const initial = createDemoData();
  const programmingTask = initial.tasks.find(
    (task) => task.area === "Programming" && task.status !== "Done",
  );
  const secondTask = {
    ...copy(programmingTask),
    id: "workbench-second-code-task",
    title: "Test robot pose after autonomous",
    owner: "Alex (you)",
    priority: "Low",
    dependencies: [],
  };
  initial.tasks.push(secondTask);
  await fixture({ initial, page: pages.Home }, async (app) => {
    const programmingMapButton = app.root.findByProps({
      "data-workstream": "Programming",
    });
    assert.ok(
      programmingMapButton,
      "The control/code workstream is selectable",
    );
    await app.update(() => programmingMapButton.props.onClick());
    assert.equal(
      app.root.findByProps({ "aria-label": "Filter workstream" }).props.value,
      "Programming",
    );
    const taskTitles = new Set(initial.tasks.map((task) => task.title));
    const queue = app.root.findByProps({
      role: "table",
      "aria-label": "Open tasks",
    });
    const visibleTaskTitles = queue
      .findAllByType("button")
      .map((button) =>
        button.children.filter((child) => typeof child === "string").join(""),
      )
      .filter((title) => taskTitles.has(title));
    assert.deepEqual(
      new Set(visibleTaskTitles),
      new Set([programmingTask.title, secondTask.title]),
    );
    await app.update(() =>
      app.root
        .findByProps({
          "aria-label": `Details for ${secondTask.title}`,
        })
        .props.onClick(),
    );
    assert.equal(
      app.root.findByProps({ id: "field-assignment-title" }).children.join(""),
      secondTask.title,
    );
    await app.update(() =>
      byText(app.root, "button", "Start work session").props.onClick(),
    );
    assert.ok(
      byText(app.root, "h3", secondTask.title),
      "The build session opens the pinned task plan",
    );
    assert.match(app.text, /FINISH LINE/);
    assert.equal(
      app.root
        .findByProps({ "aria-label": "Time remaining" })
        .children.join(""),
      "20:00",
    );
    await app.update(() =>
      app.root.findByProps({ "aria-label": "Close dialog" }).props.onClick(),
    );
    assert.equal(
      app.root.findAllByProps({ "aria-label": "Time remaining" }).length,
      0,
    );

    const nextEvent = initial.events[0];
    const seasonLine = app.root.findByProps({
      "aria-labelledby": "field-season-title",
    });
    const eventButton = seasonLine
      .findAllByType("button")
      .find((button) =>
        button
          .findAllByType("strong")
          .some((label) => label.children.includes(nextEvent.title)),
      );
    assert.ok(eventButton, "An actual team event appears on the season line");
    await app.update(() => eventButton.props.onClick());
    assert.equal(app.context.page, "calendar");
    assert.deepEqual(app.context.focusRecord, {
      page: "calendar",
      id: nextEvent.id,
    });
    assert.equal(validateData(localRepository.read()), true);
  });
});

test("student workbench keeps other-owner work read-only and hides private funding handoffs", async () => {
  const initial = createDemoData();
  const selected = otherTask(initial);
  selected.area = "Electrical";
  selected.status = "To do";
  initial.grants.forEach((grant) => {
    grant.visibility = "private";
    grant.status = "Needs Mentor Review";
  });
  initial.sponsors.forEach((sponsor) => {
    sponsor.visibility = "private";
    sponsor.followUp = "2000-01-01";
    sponsor.status = "Follow-up Due";
  });
  const before = copy(initial);
  await fixture({ initial, page: pages.Home, role: "student" }, async (app) => {
    assert.doesNotMatch(
      app.text,
      /HANDOFFS TO MAKE|Sponsor follow-ups? due|Applications? to review/,
    );
    const electricalMapButton = app.root.findByProps({
      "data-workstream": "Electrical",
    });
    assert.ok(electricalMapButton);
    await app.update(() => electricalMapButton.props.onClick());
    await app.update(() =>
      app.root
        .findByProps({
          "aria-label": `Details for ${selected.title}`,
        })
        .props.onClick(),
    );
    assert.equal(
      app.root.findByProps({ id: "field-assignment-title" }).children.join(""),
      selected.title,
    );
    assert.equal(
      byText(app.root, "button", "Start work session").props.disabled,
      true,
    );
    const complete = app.root.findByProps({
      "aria-label": `Complete ${selected.title}`,
    });
    assert.equal(complete.props.disabled, true);
    await app.update(() => complete.props.onClick());
    assert.match(app.context.notice.message, /assigned to you/);
    assert.deepEqual(app.context.data, before);
    assert.doesNotMatch(
      app.text,
      /HANDOFFS TO MAKE|Sponsor follow-ups? due|Applications? to review/,
    );
  });
});
