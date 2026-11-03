import {test,expect} from "@playwright/test";

test("mobile task details open in view and return focus to the selected task",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/tests/browser/?mode=review#home");
 const detail=page.locator("#field-next-task");
 await expect(detail).toHaveCount(0);
 const select=page.getByRole("button",{name:/^Details for /}).first();
 await select.click();
 await expect(detail).toBeFocused();
 await expect.poll(async()=>{const box=await detail.boundingBox();return !!box&&box.y>=0&&box.y<844;}).toBe(true);
 await detail.getByRole("button",{name:"Close task details"}).click();
 await expect(detail).toHaveCount(0);
 await expect(select).toBeFocused();
});

test("a collapsed task filter still shows the selected workstream",async({page})=>{
 await page.goto("/tests/browser/?mode=review#home");
 await page.getByText("Filter tasks",{exact:true}).click();
 await page.getByRole("combobox",{name:"Filter workstream"}).selectOption("Programming");
 await page.getByText("Filter tasks: Programming",{exact:true}).click();
 await expect(page.getByText("Filter tasks: Programming",{exact:true})).toBeVisible();
});
