import { expect, test, type Page } from "@playwright/test";

// One pass through each part of the app in a real browser. The engine has its own tests;
// these check that the screens around it still connect up.

/** Opens the app with the given settings already saved, and fails the test on any page error. */
async function open(page: Page, settings: Record<string, unknown> = {}, path = "/") {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript((s) => {
    if (!localStorage.getItem("po-settings")) localStorage.setItem("po-settings", JSON.stringify(s));
  }, { announcer: false, sound: false, music: false, tutorialDone: true, ...settings });
  await page.goto(path);
  return errors;
}

const fight = (page: Page) => page.locator("canvas[aria-label]");

/** Story mode: the run across the yard before a fight can always be skipped from its pause menu. */
async function skipTrail(page: Page) {
  await expect(page.locator(".trail canvas")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Skip to the fight" }).click();
}

test("arcade: pick a fighter, see the pairing, fight, pause and resume", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Arcade" }).click();
  await page.getByRole("option", { name: "Rusty" }).click();
  await page.getByRole("button", { name: "Choose Rusty" }).click();
  await expect(page.locator(".caption")).toHaveText("Fight 1 of 5");
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("tutorial: walking and jumping tick off the first two steps", async ({ page }) => {
  const errors = await open(page, { tutorialDone: false });
  await page.getByRole("button", { name: "Learn to fight" }).click();
  const step = page.locator(".lesson b");
  await expect(step).toHaveText(/^1 of 9/);
  await page.waitForTimeout(1800);
  await page.keyboard.down("KeyD");
  await expect(step).toHaveText(/^2 of 9/, { timeout: 8000 });
  await page.keyboard.up("KeyD");
  await page.keyboard.press("KeyW");
  await expect(step).toHaveText(/^3 of 9/, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("training: combo trials and the hit box overlay switch on from the pause menu", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Training" }).click();
  await page.getByRole("button", { name: "Choose Henrietta" }).click();
  await page.getByRole("button", { name: "Choose Rusty" }).click();
  await expect(fight(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Training tools" }).click();
  await page.getByRole("checkbox", { name: "Combo trials" }).click();
  await page.getByRole("checkbox", { name: "Hit boxes" }).click();
  await expect(page.getByRole("checkbox", { name: "Hit boxes" })).toBeChecked();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.locator(".trial")).toContainText("Trial 1 of 7");
  expect(errors).toEqual([]);
});

test("a whole arcade fight ends on the result screen, is saved, and can be replayed", async ({ page }) => {
  test.setTimeout(180_000);
  // ?auto (development only) has a Rooster-level CPU play this side, against the easiest opponent.
  const errors = await open(page, { rounds: 1, level: 0 }, "/?auto&speed=10");
  await page.getByRole("button", { name: "Arcade" }).click();
  await page.getByRole("button", { name: "Choose Henrietta" }).click();
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  await expect(page.locator(".result .fine")).toContainText("points");
  await expect(page.locator(".stats")).toContainText("Damage dealt");
  // One Replay button: the sheet behind it offers watching and sharing.
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.getByRole("button", { name: "Watch it now" }).click();
  await expect(fight(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Leave replay" }).click();
  await expect(page.locator(".result h1")).toBeVisible();
  // The replay can be shared as a code, and the code opens it again from the title screen.
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  const code = page.locator(".sheet textarea");
  await expect(code).toHaveValue(/^PO-REPLAY-/);
  const text = await code.inputValue();
  await page.getByRole("button", { name: "Close" }).click();
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Watch a replay from a code" }).click();
  await page.locator(".sheet textarea").fill(text);
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(fight(page)).toBeVisible();
  // The run is waiting on the title screen after a reload.
  await page.goto("/");
  // (Arcade is the second of the two big buttons, after Story.)
  const arcade = page.locator(".big-row > button").nth(1);
  await expect(arcade).toContainText(/Continue arcade|Arcade/);
  expect(errors).toEqual([]);
});

test("settings are remembered across a reload", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Controls" }).click();
  await page.getByLabel("Block button").check();
  await page.getByRole("radio", { name: "Floating" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Controls" }).click();
  await expect(page.getByLabel("Block button")).toBeChecked();
  await expect(page.getByRole("radio", { name: "Floating" })).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});

test("a gamepad can drive the menus", async ({ page }) => {
  await page.addInitScript(() => {
    const pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
    (window as unknown as { pad: typeof pad }).pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
  const errors = await open(page);
  const tap = async (button: number) => {
    await page.evaluate((b) => ((window as unknown as { pad: { buttons: { pressed: boolean }[] } }).pad.buttons[b].pressed = true), button);
    await page.waitForTimeout(80);
    await page.evaluate((b) => ((window as unknown as { pad: { buttons: { pressed: boolean }[] } }).pad.buttons[b].pressed = false), button);
    await page.waitForTimeout(120);
  };
  await tap(13); // D-pad down: focus lands on the first button
  await expect(page.getByRole("button", { name: /^Story/ })).toBeFocused();
  await tap(0); // A
  await expect(page.locator("h1")).toHaveText("Story");
  await tap(1); // B
  await expect(page.locator("h1")).toHaveText("Pecking Order");
  expect(errors).toEqual([]);
});

test("online: hosting produces an invite code", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: /^Online/ }).click();
  await page.getByRole("button", { name: "Host a match" }).click();
  const code = page.locator("textarea[readonly]");
  await expect(code).toBeVisible({ timeout: 10_000 });
  expect((await code.inputValue()).length).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test("the browser's Back button steps back through the app, and quitting a fight asks first", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: /^Versus/ }).click();
  await expect(page.locator("h1")).toContainText("choose your fighter");
  await page.goBack();
  await expect(page.locator("h1")).toHaveText("Pecking Order");

  await page.getByRole("button", { name: "Arcade" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  // Back during a fight opens the pause menu rather than leaving.
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Leave fight" }).click();
  await expect(page.getByRole("dialog", { name: "Leave the fight?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep fighting" }).click();
  await page.getByRole("button", { name: "Leave fight" }).click();
  await page.getByRole("button", { name: "Leave fight" }).click();
  await expect(page.locator("h1")).toHaveText("Pecking Order");
  expect(errors).toEqual([]);
});

test("fighter select: a move can be previewed, and the last pick is remembered", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Training" }).click();
  await page.getByRole("option", { name: "Duke" }).click();
  await page.getByRole("button", { name: "Bull rush" }).click();
  await expect(page.locator("canvas.move-preview")).toBeVisible();
  await page.getByRole("button", { name: "Choose Duke" }).click();
  await page.getByRole("radio", { name: "Cornfield at dusk" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Training" }).click();
  await expect(page.getByRole("option", { name: "Duke" })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("survival and the tournament both start", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: /^Survival/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".caption")).toHaveText("Survival: fight 1");
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: /^Tournament/ }).click();
  await page.getByRole("radio", { name: "8" }).click();
  await expect(page.locator(".entrants li")).toHaveCount(8);
  await page.getByRole("button", { name: "Make the draw" }).click();
  await expect(page.locator(".ties li")).toHaveCount(4);
  await page.getByRole("button", { name: /^Play:/ }).click();
  await expect(fight(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("the advanced lesson, the daily challenge and unlocks", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-stats")) localStorage.setItem("po-stats", JSON.stringify({ v: 2, cleared: ["pip"], fighters: { pip: { fights: 9, wins: 6 } } }));
  });
  const errors = await open(page);
  // Advanced lesson: a hen holding up in the air flutters.
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Advanced lesson" }).click();
  const step = page.locator(".lesson b");
  await expect(step).toHaveText(/^1 of 5: Flutter/);
  await page.waitForTimeout(1800);
  await page.keyboard.down("KeyW");
  await expect(step).toHaveText(/^2 of 5/, { timeout: 8000 });
  await page.keyboard.up("KeyW");

  await page.goto("/");
  await page.getByRole("button", { name: /^Daily challenge/ }).click();
  await expect(page.locator(".caption")).toHaveText("Daily challenge");

  // Clearing arcade with Pip has unlocked Old Spur and Pip's alternate feathers.
  await page.goto("/");
  await page.getByRole("button", { name: "Training" }).click();
  await expect(page.getByRole("option", { name: "Old Spur" })).toBeVisible();
  await page.getByRole("option", { name: "Pip" }).click();
  await expect(page.locator(".record")).toContainText("6 wins from 9 fights");
  await page.getByRole("checkbox", { name: "Alternate feathers" }).check();
  await expect(page.getByRole("checkbox", { name: "Alternate feathers" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("a crash shows a way to recover instead of a blank page", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { error: new Error("boom") })));
  await expect(page.getByRole("alert")).toContainText("Something went wrong");
  await expect(page.getByRole("alert")).toContainText("boom");
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Pecking Order");
});

test("the title screen keeps to the essentials, with the rest under More", async ({ page }) => {
  const errors = await open(page);
  // On a phone held upright, everything on the title screen fits without scrolling.
  await page.setViewportSize({ width: 390, height: 700 });
  const fits = await page.locator(".title").evaluate((el) => el.scrollHeight <= el.clientHeight);
  expect(fits).toBe(true);
  await expect(page.locator(".title-menu button:visible")).toHaveCount(8);
  await page.getByRole("button", { name: "More" }).click();
  for (const name of ["Survival", "Time attack", "Tournament", "Tutorial", "Advanced lesson", "How to play", "Watch a replay from a code"]) {
    await expect(page.getByRole("dialog").getByRole("button", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the calls between rounds can be skipped", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  // During the opening call the game says it can be skipped; a press of an attack does it.
  const root = page.locator(".fight");
  await expect(root).toHaveClass(/can-skip/, { timeout: 3000 });
  const began = Date.now();
  await page.keyboard.press("KeyF");
  await expect(root).not.toHaveClass(/can-skip/, { timeout: 1500 });
  // Unskipped, the call lasts well over a second from here; skipped, the clock is running almost at once.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __poDraws: number }).__poDraws), { timeout: 3000 }).toBeGreaterThan(0);
  expect(Date.now() - began).toBeLessThan(1500);
});

test.describe("on a phone held upright", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test("fighter details fold away, and one-time hints appear once", async ({ page }) => {
    const errors = await open(page);
    await page.getByRole("button", { name: "Versus" }).click();
    // Folded: the whole screen fits, and the moves are a tap away.
    await expect(page.locator(".kit")).toBeHidden();
    expect(await page.locator(".select").evaluate((el) => el.scrollHeight <= el.clientHeight + 4)).toBe(true);
    await page.getByRole("button", { name: "Moves and details" }).click();
    await expect(page.locator(".kit")).toBeVisible();
    await page.getByRole("radio", { name: "Against the CPU" }).click();
    await page.getByRole("button", { name: /^Choose/ }).click();
    await page.getByRole("button", { name: /^Choose/ }).click();
    await expect(fight(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".note.hint")).toHaveText("Turn your phone sideways for a bigger arena.");
    // Shown once per device: the next fight starts without it.
    await page.goto("/");
    await page.getByRole("button", { name: "Versus" }).click();
    await page.getByRole("button", { name: /^Choose/ }).click();
    await page.getByRole("button", { name: /^Choose/ }).click();
    await expect(fight(page)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(600);
    await expect(page.locator(".note.hint")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test("no synthesised voice: rounds and the winner are called on screen only", async ({ page }) => {
  // Note any use of the device's speech voice.
  await page.addInitScript(() => {
    (window as unknown as { __spoke: number }).__spoke = 0;
    if ("speechSynthesis" in window) window.speechSynthesis.speak = () => void ((window as unknown as { __spoke: number }).__spoke++);
  });
  const errors = await open(page, { announcer: true, rounds: 1, level: 0 }, "/?auto&speed=10");
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  expect(await page.evaluate(() => (window as unknown as { __spoke: number }).__spoke)).toBe(0);
  // And with no recorded clips, Settings has no announcer to switch on.
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Sound" }).click();
  await expect(page.getByRole("checkbox", { name: "Ring announcer" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the way out is always in the same place: Back at the top left of a screen, Close at the top right of a sheet", async ({ page }) => {
  const errors = await open(page, { rounds: 1, level: 0 }, "/?auto&speed=10");
  /** Where a control sits within its container, as fractions of the container's size. */
  const place = async (control: string, within: string) => {
    const c = (await page.locator(control).boundingBox())!;
    const w = (await page.locator(within).boundingBox())!;
    return { x: (c.x + c.width / 2 - w.x) / w.width, y: (c.y + c.height / 2 - w.y) / w.height };
  };
  // Sheets.
  for (const opener of ["Settings", "More"]) {
    await page.getByRole("button", { name: opener, exact: true }).click();
    const at = await place(".sheet-head .link", ".sheet");
    expect(at.x, `${opener}: Close is at the right`).toBeGreaterThan(0.8);
    expect(at.y, `${opener}: Close is at the top`).toBeLessThan(0.2);
    await expect(page.locator(".sheet-head .link")).toHaveText("Close");
    // The title starts at the sheet's left edge on every sheet, whatever screen it was opened from.
    const title = await page.locator(".sheet-head h2").evaluate((h) => {
      const text = document.createRange();
      text.selectNodeContents(h);
      return { gap: text.getBoundingClientRect().left - h.getBoundingClientRect().left, align: getComputedStyle(h).textAlign };
    });
    expect(title.gap, `${opener}: title is at the left`).toBeLessThan(2);
    await expect(page.locator(".sheet button", { hasText: /^(Done|Close)$/ })).toHaveCount(1);
    await page.getByRole("button", { name: "Close" }).click();
  }
  // Screens: select, online, tournament, and a result.
  const screens: [string, () => Promise<void>][] = [
    ["select", async () => void (await page.getByRole("button", { name: "Versus" }).click())],
    ["online", async () => void (await page.getByRole("button", { name: /^Online/ }).click())],
    ["tournament", async () => {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("button", { name: /^Tournament/ }).click();
    }],
  ];
  for (const [name, go] of screens) {
    await go();
    const at = await place(".bar > .link:first-child", ".screen");
    expect(at.x, `${name}: Back is at the left`).toBeLessThan(0.2);
    expect(at.y, `${name}: Back is at the top`).toBeLessThan(0.12);
    await page.locator(".bar .link").first().click();
    await expect(page.locator("h1")).toHaveText("Pecking Order");
  }
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  const at = await place(".bar > .link:first-child", ".screen");
  expect(at.x).toBeLessThan(0.2);
  expect(at.y).toBeLessThan(0.12);
  await expect(page.getByRole("button", { name: "Back to menu" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Pecking Order");
  expect(errors).toEqual([]);
});

test("one set of words and one look throughout", async ({ page }) => {
  const errors = await open(page, { rounds: 1, level: 0 }, "/?auto&speed=10");
  // The pause menu: Close at the top right like any sheet, and its switches are checkboxes as in Settings.
  await page.getByRole("button", { name: "Training" }).click();
  await expect(page.locator("h1")).toHaveText("Choose your fighter");
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator("h1")).toHaveText("Choose a sparring partner");
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  const pause = page.getByRole("dialog", { name: "Paused" });
  await expect(pause.locator(".sheet-head .link")).toHaveText("Close");
  await expect(pause.getByRole("checkbox", { name: "Sound effects" })).toBeVisible();
  await expect(pause.getByRole("button", { name: "Leave training" })).toBeVisible();
  expect(await pause.locator("h2").evaluate((h) => getComputedStyle(h).textAlign)).not.toBe("center");
  await pause.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // On a desktop, nothing says "tap".
  await page.goto("/");
  await page.getByRole("button", { name: "Versus" }).click();
  await expect(page.locator(".kit small")).toHaveText("Choose a move to see it.");
  await expect(page.getByText(/\btap\b/i)).toHaveCount(0);
  // Every screen with a bar uses the same column.
  const width = () => page.locator(".screen").evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const select = await width();
  await page.goto("/");
  await page.getByRole("button", { name: /^Online/ }).click();
  expect(await width()).toBe(select);
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: /^Tournament/ }).click();
  expect(await width()).toBe(select);
  // A finished match offers Rematch (versus) and Replay, with the same sheet behind it.
  await page.goto("/");
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  expect(await width()).toBe(select);
  await expect(page.locator(".result-actions button")).toHaveText(["Rematch", "Choose fighters", "Replay"]);
  expect(errors).toEqual([]);
});

test("story mode: its own mode, with talking heads, a line at a time, and skippable", async ({ page }) => {
  const errors = await open(page, { level: 0, rounds: 1 }, "/?auto&speed=10");
  await page.getByRole("button", { name: /^Story/ }).click();
  await expect(page.locator("h1")).toHaveText("Story");
  await page.getByRole("button", { name: /^New story/ }).click();
  await page.getByRole("option", { name: "Pip" }).click();
  await page.getByRole("button", { name: "Choose Pip" }).click();
  // The opening: the narrator, then Pip, then the first opponent and Pip's answer.
  const box = page.locator(".dialogue");
  await expect(box).toHaveClass(/narrator/);
  await expect(box.locator("p")).toContainText("Every yard has a pecking order");
  // Nobody is speaking while the narrator does: no head in the box.
  await expect(box.locator(".talking-head")).toHaveCount(0);
  for (let i = 0; i < 6 && (await box.locator("b").count()) === 0; i++) await page.locator(".cutscene").click();
  // Old Spur calls down from the roof, then Pip answers: each with their head in the box, on their own side.
  const first = await box.locator("b").textContent();
  expect(["Pip", "Old Spur"]).toContain(first);
  await expect(box.locator(".talking-head canvas")).toBeVisible();
  for (let i = 0; i < 6 && (await box.locator("b").textContent()) !== "Pip"; i++) await page.keyboard.press("Enter");
  await expect(box.locator("b")).toHaveText("Pip");
  await expect(box).toHaveClass(/from-left/);
  const headLeft = (await box.locator(".talking-head").boundingBox())!.x;
  const boxLeft = (await box.boundingBox())!.x;
  expect(headLeft - boxLeft).toBeLessThan(40);
  // Pip says his piece, the narrator counts the fights, and then the first opponent speaks up.
  for (let i = 0; i < 12 && !((await box.getAttribute("class"))?.includes("from-right") && (await box.locator("b").textContent()) !== "Old Spur"); i++) await page.keyboard.press("Enter");
  await expect(box).toHaveClass(/from-right/);
  // The other speaker's head is on the right of the box.
  const headRight = (await box.locator(".talking-head").boundingBox())!;
  const boxRight = (await box.boundingBox())!;
  expect(boxRight.x + boxRight.width - (headRight.x + headRight.width)).toBeLessThan(40);
  // Skip leaves the scene for the trail (which ?auto runs by itself), and then the pairing card and the fight.
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".caption")).toHaveText("Fight 1 of 5");
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  // After a win, the beaten opponent has a last word before the next one steps in.
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  const won = await page.getByRole("button", { name: "Continue" }).count();
  // Winning a story fight unlocks it as a chapter.
  const chapters = await page.evaluate(() => JSON.parse(localStorage.getItem("po-stats") ?? "{}").chapters ?? {});
  expect(chapters.pip ?? []).toHaveLength(won ? 1 : 0);
  if (won) {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(".cutscene")).toBeVisible();
    await expect(box.locator("p")).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test("menus have their own music, and each fight plays its arena's", async ({ page }) => {
  // Count which notes are started, by wave, to tell the tunes apart without listening.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __waves: string[] }).__waves = seen;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a: Parameters<typeof start>) {
      seen.push(this.type);
      return start.apply(this, a);
    };
  });
  const errors = await open(page, { music: true, sound: false }, "/?auto&speed=10");
  // Audio starts on the first press, as browsers require.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(2500);
  const menu = await page.evaluate(() => (window as unknown as { __waves: string[] }).__waves.splice(0));
  expect(menu.length).toBeGreaterThan(10);
  // The menu theme uses no square or sawtooth waves; the barnyard's fiddle is a sawtooth.
  expect(menu.filter((w) => w === "square" || w === "sawtooth")).toEqual([]);
  expect(errors).toEqual([]);
});

test("mashing buttons does not skip; a deliberate press after letting go does", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  const root = page.locator(".fight");
  // Mash Peck through the opening call: skipping is never offered.
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("KeyF");
    await page.waitForTimeout(110);
    await expect(root).not.toHaveClass(/can-skip/);
  }
});

test("a finished story leaves its ending to be watched again", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-stats")) localStorage.setItem("po-stats", JSON.stringify({ v: 2, stories: ["rusty"] }));
  });
  const errors = await open(page);
  await page.getByRole("button", { name: /^Story/ }).click();
  await expect(page.getByText("Endings: 1 of 10")).toBeVisible();
  await page.locator(".chips").getByRole("button", { name: "Rusty" }).click();
  // Old Spur gives way, then the narrator tells how it ended, and Rusty has the last word.
  const box = page.locator(".dialogue");
  await expect(box.locator("b")).toHaveText("Old Spur");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
  await expect(box).toHaveClass(/narrator/);
  await expect(box.locator("p")).toContainText("sun came up over the barn");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Enter");
  await expect(box.locator("b")).toHaveText("Rusty");
  await expect(box.locator("small")).toHaveText("The end");
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("Story");
  expect(errors).toEqual([]);
});

test("arcade is just the fights: no story scenes", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /^Arcade/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".caption")).toHaveText("Fight 1 of 5");
  await expect(page.locator(".cutscene")).toHaveCount(0);
});

test("tag team: four picks, and a whole match plays out", async ({ page }) => {
  // Two birds a side: rounds usually run to the clock, so a whole match takes about two minutes.
  test.setTimeout(240_000);
  const errors = await open(page, { rounds: 1, level: 0 }, "/?auto&speed=10");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: /^Tag team/ }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  for (const [heading, name] of [["Choose your lead", "Rusty"], ["Choose your partner", "Pip"], ["Choose their lead", "Duke"], ["Choose their partner", "Goldie"]]) {
    await expect(page.locator("h1")).toHaveText(heading);
    await page.getByRole("option", { name }).click();
    await page.getByRole("button", { name: `Choose ${name}` }).click();
  }
  await expect(page.locator(".versus")).toContainText("Rusty and Pip against Duke and Goldie");
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 200_000 });
  expect(errors).toEqual([]);
});

test("training: frame data, and a recording the dummy copies", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Training" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1600);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Training tools" }).click();
  await page.getByRole("checkbox", { name: "Frame data" }).check();
  await page.getByRole("button", { name: "Close" }).click();
  await page.keyboard.press("KeyF");
  await expect(page.locator(".note.frames")).toContainText("Peck starts in 4");
  // Record a few pecks, stop, and have the dummy copy them.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Training tools" }).click();
  await page.getByRole("button", { name: "Record a sequence for the dummy" }).click();
  await expect(page.locator(".notes .note").first()).toContainText("Recording for the dummy");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("KeyF");
    await page.waitForTimeout(150);
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Training tools" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Training tools" }).click();
  await page.getByRole("checkbox", { name: "Dummy copies the recording" }).check();
  await expect(page.getByRole("checkbox", { name: "Dummy copies the recording" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("story: a rival fight plays by a rule of its own", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-story")) localStorage.setItem("po-story", JSON.stringify({ v: 1, p1: "rusty", ladder: ["dot", "pip", "goldie", "ziggy", "oldspur"], rung: 3, level: 1, score: 0, bonus: false }));
  });
  const errors = await open(page);
  await page.getByRole("button", { name: /^Story/ }).click();
  await page.getByRole("button", { name: /^Continue story/ }).click();
  await expect(page.locator(".dialogue")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await skipTrail(page);
  await expect(page.locator(".caption")).toHaveText("Fight 4 of 5: your rival");
  await expect(page.locator(".versus")).toContainText("Sunrise set: 40-second rounds");
  expect(errors).toEqual([]);
});

test("chapters: a story fight already won can be played again, without touching the story in progress", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-stats")) {
      localStorage.setItem("po-stats", JSON.stringify({ v: 2, chapters: { rusty: ["dot", "pip"] } }));
      localStorage.setItem("po-story", JSON.stringify({ v: 1, p1: "goldie", ladder: ["dot", "pip", "rusty", "shelly", "oldspur"], rung: 1, level: 1, score: 0, bonus: false }));
    }
  });
  const errors = await open(page);
  await page.getByRole("button", { name: /^Story/ }).click();
  await page.getByRole("button", { name: /^Chapters/ }).click();
  // Only one fighter has chapters, so their list opens straight away.
  await expect(page.locator("h1")).toHaveText("Rusty’s story");
  const rows = page.locator(".chapter");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("Dot");
  await expect(rows.nth(1)).toContainText("Pip");
  await expect(rows.nth(2)).toBeDisabled();
  await expect(rows.nth(4)).toBeDisabled();
  // Play chapter 2: its scene, then the fight, captioned as a chapter.
  await rows.nth(1).click();
  await expect(page.locator(".dialogue")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await skipTrail(page);
  await expect(page.locator(".caption")).toHaveText("Chapter 2");
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  // The story in progress (Goldie's) is just as it was.
  const story = await page.evaluate(() => JSON.parse(localStorage.getItem("po-story") ?? "{}"));
  expect(story).toMatchObject({ p1: "goldie", rung: 1 });
  expect(errors).toEqual([]);
});

test("story choices: answering a rival calmly takes the twist away; fired up gives a full meter", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-story")) localStorage.setItem("po-story", JSON.stringify({ v: 1, p1: "rusty", ladder: ["dot", "pip", "goldie", "ziggy", "oldspur"], rung: 3, level: 1, score: 0, bonus: false }));
  });
  const errors = await open(page);
  const answer = async (which: RegExp) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Story/ }).click();
    await page.getByRole("button", { name: /^Continue story/ }).click();
    const choices = page.locator(".choices");
    // Lines move on until the choice; then nothing moves on until it is made.
    for (let i = 0; i < 12 && (await choices.count()) === 0; i++) await page.keyboard.press("Enter");
    await expect(choices.getByRole("button")).toHaveCount(2);
    await page.keyboard.press("Enter");
    await expect(choices).toBeVisible();
    await choices.getByRole("button", { name: which }).click();
    await skipTrail(page);
  };
  await answer(/Keep it civil/);
  await expect(page.locator(".versus")).toContainText("Kept civil: a fair fight, no twist");
  await answer(/Fired up/);
  await expect(page.locator(".versus")).toContainText("Fired up: you start with a full meter");
  await expect(page.locator(".versus")).toContainText("Sunrise set");
  expect(errors).toEqual([]);
});

test("boss rush: unlocked by finishing a story; everyone in a row, then the top", async ({ page }) => {
  const errors = await open(page);
  await page.getByRole("button", { name: /^Story/ }).click();
  await expect(page.getByRole("button", { name: /^Boss rush/ })).toBeDisabled();
  await page.evaluate(() => localStorage.setItem("po-stats", JSON.stringify({ v: 2, stories: ["pip"] })));
  await page.goto("/");
  await page.getByRole("button", { name: /^Story/ }).click();
  await page.getByRole("button", { name: /^Boss rush/ }).click();
  await page.getByRole("option", { name: "Pip" }).click();
  await page.getByRole("button", { name: "Choose Pip" }).click();
  await expect(page.locator(".caption")).toHaveText("Boss rush: fight 1 of 9");
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("a replay can be taken over from the pause menu, and the big calls are read out", async ({ page }) => {
  const errors = await open(page, { rounds: 1, level: 0 }, "/?auto&speed=10");
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "Against the CPU" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  // The round call is put where a screen reader will read it.
  await expect(page.locator(".sr-only[aria-live]")).toHaveText(/Round 1|Peck!/, { timeout: 5000 });
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.getByRole("button", { name: "Watch it now" }).click();
  await expect(fight(page)).toBeVisible();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Take over from here" }).click();
  await expect(page.locator(".note.taken")).toBeVisible();
  // Taken over: it is not a replay any more, so the pause menu has the usual way out.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Take over from here" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the ninth fighter: Pepper has moves of her own, and a rival fight with a rule of its own", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-story")) localStorage.setItem("po-story", JSON.stringify({ v: 1, p1: "pepper", ladder: ["dot", "pip", "goldie", "henrietta", "oldspur"], rung: 3, level: 1, score: 0, bonus: false }));
  });
  const errors = await open(page);
  // Nine fighters, five across, and her kit can be previewed like anyone's.
  await page.getByRole("button", { name: "Training" }).click();
  await expect(page.getByRole("option")).toHaveCount(9);
  await page.getByRole("option", { name: "Pepper" }).click();
  await page.getByRole("button", { name: "Hot foot" }).click();
  await expect(page.locator("canvas.move-preview")).toBeVisible();
  await page.getByRole("button", { name: "Choose Pepper" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(fight(page)).toBeVisible();
  // Her story's fourth fight is Henrietta, who keeps the list she is not on.
  await page.goto("/");
  await page.getByRole("button", { name: /^Story/ }).click();
  await page.getByRole("button", { name: /^Continue story/ }).click();
  await expect(page.locator(".dialogue")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await skipTrail(page);
  await expect(page.locator(".caption")).toHaveText("Fight 4 of 5: your rival");
  await expect(page.locator(".versus")).toContainText("Flash in the pan: one round settles it");
  expect(errors).toEqual([]);
});

test("achievements: what was done before counts, the list shows how far along the rest are, and a finished match earns one", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-stats")) localStorage.setItem("po-stats", JSON.stringify({ v: 2, fights: 22, wins: 14, bestStreak: 6, cleared: ["pip"], clears: [0, 1, 0, 0], fighters: { pip: { fights: 22, wins: 14 } } }));
  });
  // ?auto (development only) has a CPU play player 1; with two players chosen, nobody plays player 2.
  const errors = await open(page, { rounds: 1 }, "/?auto&speed=10");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Achievements: 3 of 29 earned" }).click();
  const list = page.getByRole("dialog", { name: "Achievements" });
  await expect(list.locator("li.done")).toHaveCount(3);
  await expect(list.locator("li", { hasText: "First peck" })).toContainText("Earned");
  await expect(list.locator("li", { hasText: "Cock of the walk" })).toContainText("6 of 10");
  await expect(list.locator("li", { hasText: "Flock leader" })).toContainText("1 of 9");
  await expect(list.locator("li", { hasText: "Hard-boiled" })).toContainText("Not yet");
  await page.getByRole("button", { name: "Close" }).click();
  // A match against a second player, played to the end: its achievement is announced on the result screen, and kept.
  await page.getByRole("button", { name: "Versus" }).click();
  await page.getByRole("radio", { name: "2 players" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await page.locator(".versus").click();
  await expect(page.locator(".result h1")).toBeVisible({ timeout: 150_000 });
  await expect(page.locator(".toast.earned")).toContainText("Achievement: Pecking rights");
  await page.locator(".toast.earned").getByRole("button", { name: "OK" }).click();
  await expect(page.locator(".toast.earned")).toHaveCount(0);
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("button", { name: "Achievements: 4 of 29 earned" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("story: a trail to cross before each fight, with corn worth a head start on the crow meter", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    if (!localStorage.getItem("po-story")) localStorage.setItem("po-story", JSON.stringify({ v: 1, p1: "rusty", ladder: ["dot", "pip", "goldie", "ziggy", "oldspur"], rung: 1, level: 1, score: 0, bonus: false }));
  });
  // ?auto (development only) has the test player run the trail, as it has a CPU fight the fights.
  const errors = await open(page, {}, "/?auto&speed=6");
  await page.getByRole("button", { name: /^Story/ }).click();
  await page.getByRole("button", { name: /^Continue story/ }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  const trail = page.locator(".trail canvas");
  await expect(trail).toHaveAttribute("aria-label", "Rusty on the way to Pip");
  await expect(page.locator(".trail .hint")).toContainText("Reach Pip");
  // It pauses like a fight, and the story is still where it was.
  await page.keyboard.press("Escape");
  const paused = page.getByRole("dialog", { name: "Paused" });
  for (const name of ["Resume", "Start the trail again", "Skip to the fight", "Leave story"]) await expect(paused.getByRole("button", { name })).toBeVisible();
  await paused.getByRole("button", { name: "Resume" }).click();
  // The far end is the pairing card for the same fight, and then the fight, with some meter already in hand.
  await expect(page.locator(".caption")).toHaveText("Fight 2 of 5", { timeout: 60_000 });
  await page.locator(".versus").click();
  await expect(fight(page)).toBeVisible({ timeout: 10_000 });
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("po-story")))!)).toMatchObject({ p1: "rusty", rung: 1 });
  // Arcade has no trails.
  await page.goto("/");
  await page.getByRole("button", { name: "Arcade" }).click();
  await page.getByRole("button", { name: /^Choose/ }).click();
  await expect(page.locator(".caption")).toHaveText("Fight 1 of 5");
  await expect(page.locator(".trail")).toHaveCount(0);
  expect(errors).toEqual([]);
});
