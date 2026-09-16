const puppeteer = require("puppeteer-core");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FRONT = "http://localhost:3000";
const OUT = "/tmp/opencode/shots";
const fs = require("fs");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

async function login(page, identifier, password) {
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  const inputs = await page.$$("form input");
  await inputs[0].type(identifier);
  await inputs[1].type(password);
  await Promise.all([page.click("button[type=submit]"), page.waitForNavigation({ waitUntil: "networkidle0" })]);
  await new Promise((r) => setTimeout(r, 1500));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,1000"],
    defaultViewport: { width: 1440, height: 960 },
  });

  // ---------- PUBLIC PAGES ----------
  let page = await browser.newPage();
  await page.goto(`${FRONT}/`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "01-home");
  await page.close();

  page = await browser.newPage();
  await page.goto(`${FRONT}/signup`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, "02-signup");
  await page.close();

  page = await browser.newPage();
  await page.goto(`${FRONT}/login`, { waitUntil: "networkidle0" });
  await shot(page, "03-login");
  await page.close();

  // ---------- ADMIN LOGIN ----------
  page = await browser.newPage();
  await login(page, "admin@example.com", "Admin@123");
  await shot(page, "04-admin-chat-inbox");
  await page.close();

  // ---------- CUSTOMER LOGIN ----------
  page = await browser.newPage();
  await login(page, "rahultest", "secret123");
  await shot(page, "05-customer-chat");
  await page.close();

  // ---------- CUSTOMER ACCOUNT + PLANS + SETTINGS ----------
  page = await browser.newPage();
  await login(page, "rahultest", "secret123");
  await page.goto(`${FRONT}/dashboard`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await shot(page, "06-customer-account");
  await page.goto(`${FRONT}/dashboard/plans`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await shot(page, "07-plans");
  await page.goto(`${FRONT}/dashboard/settings`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));
  await shot(page, "08-settings");
  await page.close();

  // ---------- ADMIN MANAGE USERS ----------
  page = await browser.newPage();
  await login(page, "admin@example.com", "Admin@123");
  await page.goto(`${FRONT}/dashboard/admin`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "09-admin-users");
  await page.close();

  await browser.close();
  console.log("Screenshots done:", fs.readdirSync(OUT));
})();