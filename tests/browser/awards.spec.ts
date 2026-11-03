import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("award tracker works on a narrow screen and review data resets on reload",async({page})=>{
 await page.setViewportSize({width:320,height:900});
 await page.goto("/tests/browser/?mode=review#awards");
 await expect(page.getByRole("heading",{name:"Award tracker"})).toBeVisible();
 const inspire=page.locator(".award-tracker-award").filter({hasText:"Inspire Award"});
 await inspire.locator("summary").click();
 await inspire.getByRole("combobox",{name:"Progress for Inspire: Submit a portfolio."}).selectOption("Done");
 await expect(inspire.locator("summary")).toContainText("1 of 4 required items marked done");
 const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();
 expect(results.violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await page.reload();
 // The fictional review resets on reload; real teams use shared task storage.
 await expect(page.locator(".award-tracker-award").filter({hasText:"Inspire Award"}).locator("summary")).toContainText("0 of 4");
});
