import { test, expect } from "@playwright/test";
async function sandbox(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore synthetic sandbox" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good care starts with a clear picture.",
    }),
  ).toBeVisible();
}
async function nav(page: import("@playwright/test").Page, label: string) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
}
test("register patient, persist, add medicine and record a dispensing event", async ({
  page,
}) => {
  await sandbox(page);
  await page.getByRole("button", { name: "+ Register patient" }).click();
  await page
    .getByRole("textbox", { name: "Full name" })
    .fill("Test patient · مريض تجريبي");
  await page
    .getByRole("textbox", { name: "Iraqi mobile number" })
    .fill("07701234567");
  await page.getByRole("button", { name: "Save patient" }).click();
  await expect(
    page.getByRole("heading", { name: "Test patient · مريض تجريبي" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Test patient · مريض تجريبي" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "medications", exact: true })
    .click();
  await page.getByRole("button", { name: "Add record" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Medicine name" })
    .fill("Metformin");
  await dialog.getByRole("textbox", { name: "Strength" }).fill("500 mg");
  await dialog
    .getByRole("textbox", { name: "Pharmaceutical form" })
    .fill("Tablet");
  await dialog.getByRole("textbox", { name: "Route" }).fill("Oral");
  await dialog
    .getByRole("textbox", { name: "Verified dosing instructions" })
    .fill("One tablet twice daily");
  await dialog.getByLabel("Status").selectOption("active");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Dispense Metformin", exact: true })
    .click();
  await page.getByLabel("Dispensing date").fill("2026-10-20");
  await expect(page.getByText("2026-11-18", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm & record dispensing" })
    .click();
  await page
    .getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "dispensing", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "2026-11-18", exact: true }),
  ).toBeVisible();
  await nav(page, "Refill queue");
  await page
    .getByRole("textbox", { name: "Search refill queue" })
    .fill("Test patient");
  await expect(
    page.getByRole("cell", { name: "Metformin", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", {
      name: "Contact outcome for Test patient · مريض تجريبي",
    })
    .selectOption("contacted");
  await expect(
    page.getByText("Contact outcome recorded.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("technician cannot finalize medications; platform admin cannot view patients", async ({
  page,
}) => {
  await sandbox(page);
  await page
    .getByRole("combobox", { name: "Sandbox test role" })
    .selectOption("technician");
  await nav(page, "Medications");
  await expect(page.getByRole("button", { name: "Add record" })).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Sandbox test role" })
    .selectOption("super_admin");
  await expect(
    page.getByRole("heading", { name: "Platform control center" }),
  ).toBeVisible();
  await page.goto("/app/patients");
  await expect(page).toHaveURL(/admin\/dashboard/);
});
test("Arabic direction, theme, navigation and explicit AI unavailable state", async ({
  page,
}) => {
  await sandbox(page);
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: "المظهر الداكن" }).click();
  await expect(page.locator(".theme-dark")).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await nav(page, "AI-assisted entry");
  await expect(
    page.getByRole("button", { name: "Extract — provider not configured" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("public visitors cannot access clinical or admin routes", async ({
  page,
}) => {
  await page.goto("/app/patients");
  await expect(page).toHaveURL(/login/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
});

test("all pharmacy modules remain reachable without page overflow", async ({
  page,
}) => {
  await sandbox(page);
  for (const [label, heading] of [
    ["Patients", "Patients"],
    ["Medications", "Medications"],
    ["Follow-ups", "Refill & follow-up center"],
    ["Laboratory", "Laboratory results"],
    ["Documents", "Private patient documents"],
    ["Team", "Pharmacy team"],
    ["Reports", "Pharmacy reports"],
    ["Subscription", "Your subscription"],
    ["Settings", "Workspace settings"],
  ]) {
    await nav(page, label);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
