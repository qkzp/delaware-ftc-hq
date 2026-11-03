import {test,expect} from "@playwright/test";

test("the team hub opens one conversation at a time and keeps a draft on mobile",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/tests/browser/?mode=review#team");
 await expect(page.getByRole("heading",{name:"Team hub",exact:true})).toBeVisible();
 const thread=page.locator(".team-hub-thread"),first=page.locator(".team-hub-task-list>button").first();
 await expect(thread).toHaveCount(0);
 await first.click();await expect(thread).toBeFocused();
 await page.getByLabel("Reply to this task").fill("Fictional draft for this task");
 await page.getByRole("button",{name:"Back to conversations"}).click();
 await expect(thread).toHaveCount(0);
 await first.click();await expect(page.getByLabel("Reply to this task")).toHaveValue("Fictional draft for this task");
});

test("the team hub keeps its selected workstream visible when filters are closed",async({page})=>{
 await page.goto("/tests/browser/?mode=review#team");
 const filter=page.locator(".team-hub-channels>summary");await filter.click();
 await page.getByRole("group",{name:"Conversation workstream"}).getByRole("button",{name:/^Mechanical/}).click();
 await expect(filter).toContainText("Mechanical");await filter.click();
 await expect(filter).toContainText("Mechanical");
});
