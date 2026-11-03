import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const screens=["home","team","tasks","calendar","resources","awards","robotlab","sponsors","grants","pit","evidence","settings"];
for(const theme of ["light","dark"])for(const scale of [1,2])for(const width of [320,1280])test(`${theme}, ${scale*100}% text, ${width}px: usable screens, contrast and touch targets`,async({page},testInfo)=>{
 await page.addInitScript(({theme,scale})=>localStorage.setItem("myftcspace:preferences",JSON.stringify({theme,textScale:scale})),{theme,scale});await page.setViewportSize({width,height:900});
 for(const screen of screens){await page.goto(`/tests/browser/#${screen}`);await expect(page.getByRole("heading",{level:1})).toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-theme",theme);await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe(`${16*scale}px`);
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))})),screen).toEqual([]);
  const bounds=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,documentWidth:document.documentElement.scrollWidth,scrollX,offenders:[...document.querySelectorAll("body *")].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&r.left>=0;}).slice(-8).map(e=>({tag:e.tagName,cls:e.className})),small:[...document.querySelectorAll("button")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=="hidden"&&(r.width<43.5||r.height<43.5);}).map(e=>({text:e.textContent?.slice(0,60),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),gradients:[...document.querySelectorAll("body *")].filter(e=>/gradient/.test(getComputedStyle(e).backgroundImage)).length}));expect(bounds.overflow,`${screen} overflow: ${JSON.stringify({offenders:bounds.offenders,width:bounds.documentWidth,scrollX:bounds.scrollX})}`).toBe(false);expect(bounds.small,`${screen} touch targets`).toEqual([]);expect(bounds.gradients).toBe(0);
  if(screen==="home"||screen==="settings")await page.screenshot({path:testInfo.outputPath(`${screen}.png`),fullPage:true});
 }
});

test("display preferences and view choices survive reloads and device theme changes",async({page})=>{
 await page.goto("/tests/browser/?mode=publiclab");await page.getByText("Display settings",{exact:true}).click();await page.getByRole("combobox",{name:"Color theme",exact:true}).selectOption("dark");await page.getByRole("combobox",{name:"Text size",exact:true}).selectOption("1.25");await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await page.reload();await page.getByText("Display settings",{exact:true}).click();await expect(page.getByRole("combobox",{name:"Color theme",exact:true})).toHaveValue("dark");await expect(page.getByRole("combobox",{name:"Text size",exact:true})).toHaveValue("1.25");await page.getByRole("combobox",{name:"Color theme",exact:true}).selectOption("system");await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).toHaveAttribute("data-theme","light");await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
 await page.goto("/tests/browser/#tasks");await page.getByRole("button",{name:"List view",exact:true}).click();await page.reload();await expect(page.getByRole("button",{name:"List view",exact:true})).toHaveAttribute("aria-pressed","true");expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("myftcspace:preferences")!))).toMatchObject({theme:"system",textScale:1.25,taskView:"list"});
});

test("double taps add one stage and tap feedback respects reduced motion",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/tests/browser/?mode=publiclab");await page.getByRole("button",{name:"Wheel RPM & speed",exact:true}).click();await page.getByRole("button",{name:"Use gears, belts or chain",exact:true}).click();await page.getByText("More than one drive stage",{exact:true}).click();const add=page.getByRole("button",{name:"Add another stage",exact:true});await add.dblclick();await expect(page.locator(".wheel-drive-content fieldset")).toHaveCount(2);expect(await add.evaluate(e=>getComputedStyle(e).animationName)).toBe("tap-confirm");await page.emulateMedia({reducedMotion:"reduce"});expect(await add.evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
});

test("dialog motion respects the app setting and the device setting",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});await page.goto("/tests/browser/?mode=publiclab");
 await page.getByRole("button",{name:"Motor & servo tracker",exact:true}).click();
 const open=page.getByRole("button",{name:"Add motor or servo",exact:true});await open.click();
 const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(e=>getComputedStyle(e).animationName)).toBe("dialog-arrive");
 await page.keyboard.press("Escape");await page.getByText("Display settings",{exact:true}).click();
 await page.getByRole("combobox",{name:"Motion",exact:true}).selectOption("reduced");await open.click();
 expect(await dialog.evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
 await page.keyboard.press("Escape");await page.getByRole("combobox",{name:"Motion",exact:true}).selectOption("system");
 await page.emulateMedia({reducedMotion:"reduce"});await open.click();
 expect(await dialog.evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
});

test("a fresh team has meaningful content and next steps on every screen and tool",async({page})=>{
 for(const screen of screens){await page.goto(`/tests/browser/?mode=fresh#${screen}`);await expect(page.getByRole("heading",{level:1})).toBeVisible();expect((await page.locator("#main-content").innerText()).trim().length).toBeGreaterThan(100);expect(await page.locator("#main-content").getByRole("button").count()).toBeGreaterThan(0);}
 await page.goto("/tests/browser/?mode=publiclab");for(const tool of ["PID trainer","Autonomous planner","Motor & servo tracker","Wheel RPM & speed","Robot profiles","Motor tests","Servo & maintenance","Compare drivetrains"]){await page.getByRole("button",{name:tool,exact:true}).click();await expect(page.getByRole("heading",{level:2}).first()).toBeVisible();}
});

test("technical server errors are replaced with actionable messages",async({page})=>{
 await page.route("**/api/session",route=>route.fulfill({status:500,json:{error:"SQLITE_ERROR SELECT secret_token FROM auth_users; TypeError at server.ts:123"}}));await page.goto("/tests/browser/?mode=account");await expect(page.getByRole("alert")).toContainText(/connection|try again/);await expect(page.locator("body")).not.toContainText("SQLITE_ERROR");await expect(page.locator("body")).not.toContainText("secret_token");await expect(page.getByRole("heading",{level:1})).toBeVisible();
});

test("a focused modal input stays inside the resized visual viewport",async({page})=>{
 await page.addInitScript(()=>{const viewport=new EventTarget() as EventTarget&{height:number;offsetTop:number;offsetLeft:number;width:number};Object.assign(viewport,{height:900,offsetTop:0,offsetLeft:0,width:400});Object.defineProperty(window,"visualViewport",{value:viewport,configurable:true});});await page.setViewportSize({width:400,height:900});await page.goto("/tests/browser/?mode=publiclab");await page.getByRole("button",{name:"Motor & servo tracker",exact:true}).click();await page.getByRole("button",{name:"Add motor or servo",exact:true}).click();const input=page.getByRole("dialog").getByRole("textbox",{name:"Test conditions / notes",exact:true});await input.focus();await page.evaluate(()=>{(window.visualViewport as any).height=360;window.visualViewport!.dispatchEvent(new Event("resize"));});await expect.poll(async()=>{const box=(await input.boundingBox())!;return box.y>=0&&box.y+box.height<=360;}).toBe(true);await input.fill("Input remains visible above the simulated keyboard.");await expect(input).toHaveValue("Input remains visible above the simulated keyboard.");
});

test("public tools and welcome remain readable in dark mode with enlarged text",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("myftcspace:preferences",JSON.stringify({theme:"dark",textScale:2})));await page.setViewportSize({width:400,height:900});
 for(const mode of ["welcome","publiclab"]){await page.goto(`/tests/browser/?mode=${mode}`);if(mode==="publiclab")for(const tool of ["PID trainer","Autonomous planner","Motor & servo tracker","Wheel RPM & speed","Robot profiles","Motor tests","Servo & maintenance","Compare drivetrains"]){await page.getByRole("button",{name:tool,exact:true}).click();const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}else{const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}}
});
