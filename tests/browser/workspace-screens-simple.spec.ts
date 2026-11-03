import {test,expect} from "@playwright/test";

test("task filters open on request and their active state stays visible",async({page})=>{
 await page.goto("/tests/browser/?mode=review#tasks");
 await expect(page.getByRole("heading",{name:"Tasks",exact:true})).toBeVisible();
 await expect(page.getByRole("textbox",{name:"Search tasks"})).toBeVisible();
 await page.getByText("Team progress",{exact:true}).click();
 await expect(page.getByRole("progressbar",{name:"Team task completion"})).toBeVisible();
 await page.getByText("Team progress",{exact:true}).click();
 const filters=page.locator(".tc-extra-filters");
 await expect(filters).not.toHaveAttribute("open","");
 await filters.locator("summary").click();
 await page.getByRole("combobox",{name:"Filter work area"}).selectOption("Mechanical");
 await expect(filters.locator("summary")).toContainText("1 active");
 await filters.locator("summary").click();
 await expect(filters.locator("summary")).toContainText("1 active");
 await expect(page.getByRole("button",{name:"List view",exact:true})).toBeVisible();
});

test("calendar file actions remain accessible on demand",async({page})=>{
 await page.setViewportSize({width:320,height:900});
 await page.goto("/tests/browser/?mode=review#calendar");
 await expect(page.getByRole("heading",{name:"Schedule",exact:true})).toBeVisible();
 const actions=page.locator(".tc-calendar-file-actions");
 await expect(actions).not.toHaveAttribute("open","");
 await actions.locator("summary").click();
 await expect(page.getByRole("button",{name:"Export calendar",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Import calendar",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"New event",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
});
