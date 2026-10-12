import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
test("public pages and mobile widths remain accessible", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Less uncertainty/ }),
  ).toBeVisible();
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "docs/screenshots/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/landing-mobile.png",
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  for (const path of [
    "/features",
    "/how-it-works",
    "/for-customers",
    "/for-service-centers",
    "/service-centers",
    "/service-centers/demo-center-colombo",
    "/contact",
    "/privacy",
    "/terms",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("owner can sign in, add a vehicle, persist it, and request a service", async ({
  page,
}) => {
  test.skip(
    !process.env.DEMO_PASSWORD,
    "Seed local demo accounts and set DEMO_PASSWORD.",
  );
  const reg = `E2E${randomUUID().slice(0, 7).toUpperCase()}`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@fixflow.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Ari." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/customer-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My vehicles", exact: true }).click();
  await page
    .getByRole("button", { name: "Add a vehicle", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Registration number").fill(reg);
  await dialog.getByLabel("Make", { exact: true }).fill("Test");
  await dialog.getByLabel("Model", { exact: true }).fill("Roadster");
  await dialog.getByLabel("Manufacturing year").fill("2024");
  await dialog.getByLabel("Vehicle category").selectOption("Car");
  await dialog.getByLabel("Fuel type").selectOption("Electric");
  await dialog.getByLabel("Transmission").selectOption("Automatic");
  await dialog.getByLabel("Current mileage (km)").fill("1000");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText(reg, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Appointments", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Book a service", exact: true })
    .click();
  const booking = page.getByRole("dialog");
  await booking
    .locator('select[name="vehicleId"]')
    .selectOption({ label: `${reg} — Test Roadster` });
  await booking
    .getByLabel("Service center", { exact: true })
    .selectOption("demo-center-colombo");
  await booking
    .getByLabel("Service", { exact: true })
    .selectOption("demo-general-service");
  const day = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  await booking.getByLabel("Preferred date").fill(day);
  await booking.getByRole("button", { name: "Check available times" }).click();
  await booking.locator(".slot").first().click();
  await booking
    .getByLabel("What does your vehicle need?")
    .fill("End-to-end verification of service booking");
  await booking.getByRole("button", { name: "Request appointment" }).click();
  await expect(booking).toBeHidden();
  await expect(page.getByText(reg, { exact: true })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: reg });
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(row.getByText("cancelled", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "My vehicles", exact: true }).click();
  const card = page.locator(".vehicle-card").filter({ hasText: reg });
  await card.getByRole("link", { name: /Mileage & service records/ }).click();
  await expect(
    page.getByRole("heading", { name: "Mileage readings" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "1,000 km" })).toBeVisible();
  await page.getByRole("link", { name: /All vehicles/ }).click();
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm change", exact: true })
    .click();
  await expect(card.getByText("archived", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back, Ari." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/mobile-open/);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/customer-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("authentication API uses database sessions, prevents role escalation and guards private mutations", async ({
  request,
}) => {
  const origin = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  for (const path of ["/api/cron/reminders", "/api/cron/notifications"]) {
    expect((await request.post(path)).status()).toBe(401);
    expect(
      (
        await request.post(path, {
          headers: { authorization: "Bearer incorrect" },
        })
      ).status(),
    ).toBe(401);
  }
  expect((await request.get("/api/vehicles")).status()).toBe(401);
  const email = `e2e-${randomUUID()}@example.test`;
  const password = randomUUID() + "Secure!";
  const signup = await request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { name: "E2E account", email, password, role: "SUPER_ADMIN" },
  });
  expect(signup.ok()).toBe(true);
  const state = await request.get("/api/workspace");
  expect(state.ok()).toBe(true);
  expect((await state.json()).data.user.role).toBe("CUSTOMER");
  expect((await request.get("/api/reports/export")).status()).toBe(403);
  expect((await request.post("/api/vehicles", { data: {} })).status()).toBe(
    403,
  );
  expect(
    (
      await request.post("/api/centers", { headers: { origin }, data: {} })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/sign-out", {
        headers: { origin },
        data: {},
      })
    ).ok(),
  ).toBe(true);
  expect((await request.get("/api/vehicles")).status()).toBe(401);
  const resetRequest = await request.post("/api/auth/request-password-reset", {
    headers: { origin },
    data: { email, redirectTo: "/reset-password" },
  });
  expect(resetRequest.ok()).toBe(true);
  const mails = await Promise.all(
    (await readdir(".local/mail")).map(
      async (file) =>
        JSON.parse(await readFile(`.local/mail/${file}`, "utf8")) as {
          to: string;
          text: string;
        },
    ),
  );
  const mail = mails.find((m) => m.to === email);
  expect(mail).toBeTruthy();
  const url = mail!.text.match(/https?:\/\/\S+/)?.[0];
  expect(url).toBeTruthy();
  const resetRedirect = await request.get(url!, { maxRedirects: 0 });
  const location = resetRedirect.headers()["location"];
  const token = new URL(location, origin).searchParams.get("token");
  expect(token).toBeTruthy();
  const replacement = randomUUID() + "NewSecure!";
  expect(
    (
      await request.post("/api/auth/reset-password", {
        headers: { origin },
        data: { token, newPassword: replacement },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post("/api/auth/reset-password", {
        headers: { origin },
        data: { token, newPassword: password },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: { email, password: replacement },
      })
    ).ok(),
  ).toBe(true);
  await request.post("/api/auth/sign-out", { headers: { origin }, data: {} });
});

test("manager, technician and administrator pages enforce role workspaces", async ({
  browser,
}) => {
  test.skip(!process.env.DEMO_PASSWORD, "Seed demo accounts first.");
  for (const [email, base, links] of [
    [
      "manager@fixflow.example",
      "manager",
      [
        "Appointments",
        "Work orders",
        "Technicians",
        "Inventory",
        "Invoices & payments",
        "Reports",
        "Center settings",
      ],
    ],
    [
      "technician@fixflow.example",
      "technician",
      ["Assigned jobs", "Notifications", "My profile"],
    ],
    [
      "admin@fixflow.example",
      "admin",
      ["Service centers", "Users & access", "Audit logs"],
    ],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const origin = process.env.E2E_BASE_URL ?? "http://localhost:3000";
    const response = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { origin },
        data: { email, password: process.env.DEMO_PASSWORD },
      },
    );
    expect(response.ok()).toBe(true);
    const report = await context.request.get(`${origin}/api/reports/export`);
    if (base === "manager") {
      expect(report.ok()).toBe(true);
      expect(report.headers()["content-type"]).toContain("text/csv");
      expect(await report.text()).toContain(
        "Month,Recorded revenue (LKR),Appointments",
      );
    } else expect(report.status()).toBe(403);
    if (base === "admin") {
      const created = await context.request.post(`${origin}/api/centers`, {
        headers: { origin },
        data: {
          name: `Browser approval ${randomUUID()}`,
          address: "Test address",
          district: "Test",
          phone: "000",
          email: "test@example.test",
        },
      });
      expect(created.ok()).toBe(true);
      const center = (await created.json()).data;
      expect(center.active).toBe(false);
      expect(center.approvedAt).toBeNull();
      expect(
        (
          await (
            await context.request.get(
              `${origin}/api/service-centers/${center.id}`,
            )
          ).json()
        ).data,
      ).toHaveLength(0);
      const approved = await context.request.patch(
        `${origin}/api/centers/${center.id}`,
        { headers: { origin }, data: { active: true } },
      );
      expect(approved.ok()).toBe(true);
      expect((await approved.json()).data.approvedAt).toBeTruthy();
      expect(
        (
          await (
            await context.request.get(
              `${origin}/api/service-centers/${center.id}`,
            )
          ).json()
        ).data,
      ).toHaveLength(1);
      expect(
        (
          await context.request.patch(`${origin}/api/centers/${center.id}`, {
            headers: { origin },
            data: { active: false },
          })
        ).ok(),
      ).toBe(true);
    }
    if (base === "manager") {
      const fields = {
        centerId: "demo-center-colombo",
        sku: randomUUID(),
        name: "Browser inventory test",
        cost: 12550,
        price: 20000,
        reorderLevel: 2,
      };
      const created = await context.request.post(`${origin}/api/inventory`, {
        headers: { origin },
        data: fields,
      });
      expect(created.ok()).toBe(true);
      const part = (await created.json()).data;
      const updated = await context.request.patch(
        `${origin}/api/inventory/${part.id}`,
        {
          headers: { origin },
          data: { ...fields, price: 22550, active: false },
        },
      );
      expect(updated.ok()).toBe(true);
      expect((await updated.json()).data.price).toBe(22550);
      await page.goto(`${origin}/manager/inventory`);
      const row = page.getByRole("row").filter({ hasText: fields.sku });
      await row.getByRole("button", { name: "Edit spare part" }).click();
      const editor = page.getByRole("dialog");
      await expect(editor.getByLabel("Selling price (LKR)")).toHaveValue(
        "225.50",
      );
      await editor.getByLabel("Selling price (LKR)").fill("175.25");
      const saved = page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/inventory/${part.id}`) &&
          r.request().method() === "PATCH",
      );
      await editor.getByRole("button", { name: "Save changes" }).click();
      expect((await (await saved).json()).data.price).toBe(17525);
      await expect(editor).toBeHidden();
    }
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(new RegExp(`/${base}$`));
    for (const name of links) {
      await page
        .getByRole("navigation", { name: "Workspace" })
        .getByRole("link", { name, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByText("Something interrupted your journey."),
      ).toHaveCount(0);
    }
    if (base !== "admin") {
      await page.goto(
        `${origin}/${base}/${base === "manager" ? "work-orders" : "jobs"}`,
      );
      const href = await page
        .locator(
          'table a[href*="/' +
            (base === "manager" ? "work-orders" : "jobs") +
            '/"]',
        )
        .first()
        .getAttribute("href");
      if (href) {
        await page.goto(origin + href);
        await expect(
          page.getByRole("heading", { name: "Your service journey" }),
        ).toBeVisible();
        await page.screenshot({
          path: `docs/screenshots/${base}-repair.png`,
          fullPage: true,
        });
      }
    }
    await context.close();
  }
});
