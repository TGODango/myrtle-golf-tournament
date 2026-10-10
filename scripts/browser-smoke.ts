import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000");
  await page.getByRole("heading", { name: "The road to 9½." }).waitFor();
  await page.screenshot({ path: "/tmp/myrtle-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /My Scorecard$/ }).click();
  await page.getByRole("button", { name: "Save hole 1", exact: true }).click();
  await page.getByRole("status").waitFor();
  assert.match(await page.getByRole("status").innerText(), /Saved in demo/);
  await page.reload();
  await page.getByRole("button", { name: /My Scorecard$/ }).click();
  assert.match(
    await page.locator(".score-entry").innerText(),
    /Currently saved: 4/,
  );
  await page.getByRole("button", { name: /Admin Dashboard$/ }).click();
  await page
    .getByRole("heading", { name: "Teams & roster", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Save roster", exact: true }).click();
  await page.getByRole("button", {name:/Matchup Draft$/}).click();
  await page.getByRole("button", {name:"Unlock pairings",exact:true}).click();
  await page.getByRole("button", {name:"Save matchup draft",exact:true}).click();
  assert.equal(await page.locator('.draft select').first().inputValue(),'0');
  assert.equal(await page.getByLabel('James Wilson',{exact:true}).isChecked(),true);
  await page.getByRole("button", {name:"Approve and lock pairings",exact:true}).click();
  await page.getByRole("button", {name:"Unlock pairings",exact:true}).waitFor();
  await page.getByRole("button", { name: /Schedule$/ }).click();
  assert.equal(await page.locator(".schedule .panel").count(), 5);
  await page
    .getByRole("button", { name: "TV leaderboard", exact: false })
    .click();
  assert.equal(await page.locator(".tv").count(), 1);
  await page.getByRole("button", { name: "Exit TV mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".mobile-menu").click();
  await page.getByRole("button", { name: /Home$/ }).click();
  await page.screenshot({ path: "/tmp/myrtle-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Browser smoke passed: persistence, scoring, administration, schedule, TV, mobile layout; no runtime errors.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
