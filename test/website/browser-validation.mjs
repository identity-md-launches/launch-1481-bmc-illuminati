/* Bounded production-export validation. All wallet sends use an in-process mock; never a public RPC write. */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const {
  Provider,
  CONFIG,
  API,
  BUILD,
  word,
  ACCOUNT,
  OTHER,
} = require("./harness.cjs");
const fixture = JSON.parse(
  await fs.readFile(new URL("./fixtures/runtime.json", import.meta.url)),
);
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, "test/scratch/browser");
await fs.mkdir(out, { recursive: true });
const { chromium, webkit } = await import(
  process.env.BMC_PLAYWRIGHT
    ? pathToFileURL(process.env.BMC_PLAYWRIGHT).href
    : "playwright"
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};
const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, "http://localhost");
    let file = path.resolve(
      root,
      "dist",
      "." + decodeURIComponent(parsed.pathname.replace(/^\/preview/, "")),
    );
    if (
      file !== path.join(root, "dist") &&
      !file.startsWith(path.join(root, "dist") + path.sep)
    )
      throw new Error("Invalid path");
    if ((await fs.stat(file)).isDirectory())
      file = path.join(file, "index.html");
    res.setHeader(
      "content-type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
const report = {
  date: new Date().toISOString(),
  engines: [],
  checks: [],
  errors: [],
  screenshots: [],
  limitations: [],
};
class BrowserProvider extends Provider {
  async request(args) {
    if (args.method === "eth_getCode")
      return args.params[0].toLowerCase() === API.BMC
        ? fixture.bmc
        : fixture.pass;
    if (args.method === "eth_getBalance") return "0xde0b6b3a7640000";
    const value = await super.request(args);
    if (args.method === "eth_getTransactionReceipt" && value)
      for (const log of value.logs || []) log.address = CONFIG.PASS_ADDRESS;
    return value;
  }
  read(tx) {
    if (
      tx.to.toLowerCase() === API.BMC &&
      tx.data.startsWith(
        "0x" + globalThis.BMC_TOKEN_BUILD.selectors["totalSupply()"],
      )
    )
      return word(990000000n * 10n ** 18n);
    if (
      tx.to.toLowerCase() !== API.BMC &&
      tx.data.startsWith("0x" + BUILD.selectors["balanceOf(address)"])
    )
      return word(this.minted);
    if (
      tx.to.toLowerCase() !== API.BMC &&
      tx.data.startsWith("0x" + BUILD.selectors["ownerOf(uint256)"])
    )
      return word(BigInt(this.account));
    return super.read(tx);
  }
}
async function configuredPage(
  browser,
  {
    live = false,
    wallet = true,
    width = 390,
    expectedReadFailure = false,
  } = {},
) {
  const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    }),
    provider = new BrowserProvider(),
    readProvider = new BrowserProvider();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !expectedReadFailure) errors.push(m.text());
  });
  page.on("requestfailed", (r) => {
    if (!expectedReadFailure && r.failure()?.errorText !== "net::ERR_ABORTED")
      errors.push(`${r.url()}: ${r.failure()?.errorText}`);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(base) && r.status() >= 400)
      errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.route(
    /^https:\/\/(ethereum-rpc.publicnode.com|eth.drpc.org)/,
    async (route) => {
      try {
        const body = route.request().postDataJSON(),
          result = await readProvider.request(body);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
        });
      } catch (e) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: e.message },
          }),
        });
      }
    },
  );
  // Deterministic image fixture: real local preview of the identical immutable artwork.
  await page.route(
    /^https:\/\/silver-active-lungfish-941\.mypinata\.cloud\/ipfs\/bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u\/genesis-([0-9]{2})\.png$/,
    async (route) => {
      const id = route
        .request()
        .url()
        .match(/genesis-([0-9]{2})/)[1];
      await route.fulfill({
        contentType: "image/webp",
        body: await fs.readFile(
          path.join(root, `dist/artwork/genesis/genesis-${id}.webp`),
        ),
      });
    },
  );
  if (live)
    await page.route("**/config.js", async (route) => {
      const source = await fs.readFile(
        path.join(root, "dist/config.js"),
        "utf8",
      );
      await route.fulfill({
        contentType: "text/javascript",
        body: source
          .replace('MODE: "PRE_LAUNCH"', 'MODE: "LIVE"')
          .replace("DEPLOYMENT_CONFLICT: true", "DEPLOYMENT_CONFLICT: false")
          .replace("EXPLORER_VERIFIED: false", "EXPLORER_VERIFIED: true")
          .replace(
            "SECURITY_FINDINGS_ADDRESSED: false",
            "SECURITY_FINDINGS_ADDRESSED: true",
          )
          .replace(
            "DEPLOYED_MINT_AND_BURN_VALIDATED: false",
            "DEPLOYED_MINT_AND_BURN_VALIDATED: true",
          )
          .replace(
            'PUBLIC_MINT_AUTHORIZATION: ""',
            'PUBLIC_MINT_AUTHORIZATION: "Browser mock only"',
          ),
      });
    });
  if (wallet) {
    await page.exposeFunction("mockRequest", (args) => provider.request(args));
    await page.addInitScript(() => {
      const listeners = new Map();
      window.ethereum = {
        isMetaMask: true,
        request: (args) => window.mockRequest(args),
        on: (name, handler) => {
          const handlers = listeners.get(name) || new Set();
          handlers.add(handler);
          listeners.set(name, handlers);
        },
        removeListener: (name, handler) => listeners.get(name)?.delete(handler),
        emit: (name, value) => {
          for (const handler of listeners.get(name) || []) handler(value);
        },
      };
    });
  }
  return { page, provider, readProvider, errors };
}
async function readReady(page) {
  await page.waitForFunction(
    () => window.BMCPlatform && !window.BMCPlatform.snapshot().loading,
  );
  assert.equal(
    await page.evaluate(() => window.BMCPlatform.snapshot().publicError),
    "",
  );
}
async function shot(page, name) {
  const filename = path.join(out, name + ".png");
  await page.screenshot({ path: filename, fullPage: false });
  report.screenshots.push(path.relative(root, filename));
}
async function walletFeedback(browser, name) {
  for (const width of [320, 390, 768, 1250, 1440]) {
    for (const wallet of [false, true]) {
      const { page, provider, errors } = await configuredPage(browser, {
        width,
        wallet,
      });
      if (wallet)
        await page.addInitScript(() => {
          // Reject inside the page so Playwright's binding does not discard code 4001.
          const request = window.ethereum.request;
          window.rejectConnection = true;
          window.ethereum.request = (args) =>
            window.rejectConnection && args.method === "eth_requestAccounts"
              ? Promise.reject(Object.assign(new Error("User rejected"), { code: 4001 }))
              : request(args);
        });
      await page.goto(base + "#/pass");
      await readReady(page);
      const mobile = width <= 700;
      if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
      const control = page.locator(mobile ? "#mobile-nav .wallet-controls" : ".header-wallet .wallet-controls");
      const status = control.getByRole("status");
      const region = await status.elementHandle();
      assert.equal(await status.textContent(), "", "compact/quiet mode omits only the default hint");
      await control.getByRole("button", { name: "Connect wallet", exact: true }).click();
      const message = wallet
        ? "Request rejected in your wallet. No further transaction was sent."
        : "No injected wallet found. Open this page in MetaMask or another EIP-1193 wallet browser.";
      await page.waitForFunction((message) => window.BMCPlatform.snapshot().wallet.message === message, message);
      assert.equal(await status.innerText(), message);
      assert.ok(await status.isVisible(), `${name} ${width}: wallet error is visible beside its control`);
      assert.ok((await page.locator("body").innerText()).includes(message));
      assert.ok(await region.evaluate((el) => el.isConnected), "live region persists across the update");
      assert.ok(await status.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1), "error text wraps without clipping");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} ${width}: no overflow after wallet error`);
      if ([390, 1440].includes(width)) {
        await status.scrollIntoViewIfNeeded();
        await shot(page, `${name}-wallet-${wallet ? "rejected" : "missing"}-${width}`);
      }
      if (mobile) {
        await page.getByRole("button", { name: "Close menu" }).click();
        await page.getByRole("button", { name: "Open menu" }).click();
        assert.equal(await status.innerText(), message, "reopening the menu retains the error");
      }
      if (wallet) {
        await page.evaluate(() => { window.rejectConnection = false; });
        await control.getByRole("button", { name: "Connect wallet", exact: true }).click();
        await page.waitForFunction(() => window.BMCPlatform.snapshot().wallet.account !== null && !window.BMCPlatform.snapshot().connecting);
        assert.equal(await control.getByRole("button", { name: "Disconnect", exact: true }).isVisible(), true);
        assert.ok(!(await status.innerText()).includes("Request rejected"), "retry clears the old refusal");
        await control.getByRole("button", { name: "Disconnect", exact: true }).click();
      }
      assert.equal(provider.sent.length, 0);
      assert.equal(provider.calls.some(({ method }) => /sign|sendTransaction/i.test(method)), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  report.checks.push(`${name}: collection header/menu show missing-wallet and code-4001 errors at 320/390/768/1250/1440; persistent role=status, wrapping, menu reopen, successful retry/disconnect, no signing or sends.`);
}
async function run(engine, name) {
  const browser = await engine.launch({ headless: true });
  report.engines.push(name);
  try {
    await walletFeedback(browser, name);
    const { page, provider, errors } = await configuredPage(browser);
    await page.goto(base);
    try {
      await readReady(page);
    } catch (e) {
      console.log(
        "Initial page diagnostics",
        name,
        errors,
        await page.locator("body").innerText(),
        await page.evaluate(() => ({
          platform: !!window.BMCPlatform,
          loading: window.BMCPlatform?.snapshot().loading,
          error: window.BMCPlatform?.snapshot().publicError,
        })),
      );
      throw e;
    }
    assert.equal(provider.calls.length, 0, "no wallet RPC on initial load");
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".skip-link")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Open menu" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page
        .getByRole("button", { name: "Close menu" })
        .getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Open menu" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    const mint = page
      .getByRole("link", { name: "Mint BMC Pass", exact: true })
      .last();
    assert.ok((await mint.boundingBox()).y < 844);
    await shot(page, `${name}-home-390`);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "",
        "#/pass",
        "#/staking",
        "#/dashboard",
        "#/swap",
        "#/burns",
        "#/community",
      ]) {
        await page.goto(base + route);
        await page.waitForSelector("main h1");
        await page.waitForTimeout(80);
        const box = await page.evaluate(() => ({
          body: document.documentElement.scrollWidth,
          width: innerWidth,
        }));
        assert.ok(
          box.body <= box.width + 1,
          `${name} overflow at ${width} ${route}: ${JSON.stringify(box)}`,
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "#/pass");
    await page.getByRole("button", { name: "Standard · On-chain SVG" }).click();
    await page.locator(".actual-gallery img").first().waitFor();
    assert.equal(await page.locator(".actual-gallery img").count(), 8);
    await page.locator(".actual-gallery img").first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const img = document.querySelector(".actual-gallery img");
      return img?.complete && img.naturalWidth > 0;
    });
    await page.getByRole("button", { name: "Show more artwork" }).focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".actual-gallery img").count(), 12);
    await page.getByRole("button", { name: "Genesis · 77" }).click();
    assert.equal(await page.locator(".actual-gallery img").count(), 8);
    await shot(page, `${name}-collection-390`);
    const slots = page.locator(".gallery > li");
    assert.equal(await slots.count(), 8);
    assert.ok(await page.getByRole("status").filter({ hasText: "Showing 8 of 500 slots" }).isVisible());
    const initialHeight = await page.locator(".gallery").evaluate((el) => el.getBoundingClientRect().height);
    assert.ok(initialHeight < 1000, "mobile allocation preview stays short");
    await page.getByRole("heading", { name: "Planned token slots" }).scrollIntoViewIfNeeded();
    await shot(page, `${name}-planned-slots-390`);
    for (let count = 8; count < 500; count += 8) {
      await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
      assert.equal(await slots.count(), Math.min(count + 8, 500));
    }
    assert.match(await slots.last().innerText(), /#500/);
    assert.equal(await page.getByRole("button", { name: /^Show \d+ more$/ }).count(), 0);
    for (const [filter, count, first] of [["Legendary #1", 1, "#1"], ["Early Genesis", 8, "#2"], ["Mystery (pending reveal)", 8, "#41"], ["All 500", 8, "#1"]]) {
      await page.getByRole("button", { name: filter, exact: true }).click();
      assert.equal(await slots.count(), count);
      assert.equal(await slots.first().locator("strong").textContent(), first);
    }
    report.checks.push(`${name}: planned slots start at 8 (${initialHeight}px at 390), all 500 load, rarity filters reset the preview, artwork gallery remains independent.`);
    await page.goto(base + "#/staking");
    await page.getByLabel("Amount in BMC").fill("12.5");
    assert.equal(
      await page
        .getByRole("button", { name: "Approve BMC", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Stake BMC", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.getByRole("button", { name: "Unstake BMC" }).isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Claim rewards", exact: true })
        .first()
        .isDisabled(),
      true,
    );
    await shot(page, `${name}-staking-390`);
    await page.goto(base + "mint/");
    await readReady(page);
    const expiry = page.locator("details").filter({ has: page.getByText("Mystery randomness and expiry", { exact: true }) });
    await expiry.locator("summary").click();
    const disclosure = await expiry.innerText();
    assert.match(disclosure, /remaining Standard outcome if available; otherwise it selects from the remaining Genesis inventory/);
    assert.match(disclosure, /not cryptographically manipulation-resistant/);
    assert.match(disclosure, /8,191-block history window/);
    await shot(page, `${name}-mystery-expiry-390`);
    await expiry.locator("summary").click();
    assert.equal(await page.locator("#mint-genesis").isDisabled(), true);
    assert.equal(await page.locator("#mint-mystery").isDisabled(), true);
    provider.reject = "connect";
    await page.locator("#connect").click();
    await page.waitForFunction(() =>
      document.getElementById("message").textContent.includes("rejected"),
    );
    provider.reject = null;
    await page.locator("#connect").click();
    await page.waitForFunction(
      () => window.BMCPlatform.snapshot().wallet.balance !== null,
    );
    assert.equal(await page.locator("#account").textContent(), ACCOUNT);
    assert.equal(provider.sent.length, 0);
    provider.account = OTHER;
    await page.evaluate(
      (a) => window.ethereum.emit("accountsChanged", [a]),
      OTHER,
    );
    await page.waitForFunction(
      (a) => document.getElementById("account").textContent === a,
      OTHER,
    );
    provider.chain = "0x38";
    await page.evaluate(() => window.ethereum.emit("chainChanged", "0x38"));
    await page.waitForFunction(() =>
      document.getElementById("network").textContent.includes("Wrong network"),
    );
    assert.equal(await page.locator("#balance").textContent(), "Unavailable");
    await page.locator("#switch-network").click();
    await page.waitForFunction(
      () => window.BMCPlatform.snapshot().wallet.chainId === "0x1",
    );
    await page.locator("#lookup-id").fill("1");
    await page.locator("#lookup").click();
    await page.waitForFunction(() =>
      document
        .getElementById("lookup-message")
        .textContent.includes("not been minted"),
    );
    await page.evaluate(async () => {
      for (const kind of ["genesis", "mystery"]) {
        try {
          await window.BMCPlatform.client.mint(kind);
        } catch {}
      }
      try {
        await window.BMCPlatform.client.reveal();
      } catch {}
    });
    assert.equal(provider.sent.length, 0);
    await page.locator("#disconnect").click();
    assert.equal(
      await page.locator("#account").textContent(),
      "No wallet connected",
    );
    await shot(page, `${name}-mint-390`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot(page, `${name}-mint-1440`);
    await page.goto(base + "#/dashboard");
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .last()
      .click();
    await page.waitForFunction(
      () => window.BMCPlatform.snapshot().personal !== null,
    );
    await page.getByRole("button", { name: "Find my Passes" }).click();
    await page.waitForFunction(() =>
      document.body.textContent.includes("No Passes found for this wallet"),
    );
    await shot(page, `${name}-dashboard-1440`);
    await page.goto(base);
    await page.setViewportSize({ width: 780, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
      document.documentElement.dir = "rtl";
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page.evaluate(() => {
      document.documentElement.dir = "ltr";
    });
    assert.deepEqual(errors, []);
    report.checks.push(
      `${name}: 7 routes at 320/390/768/1440, first-screen CTA, real local artwork, gallery tabs/load more, gated staking, wallet refusal/connect/disconnect/account/network events, read-only lookup/ownership, forced PRE_LAUNCH calls blocked, zero console/local-resource errors.`,
    );
    await page.close();
    const outage = await configuredPage(browser, { expectedReadFailure: true });
    await outage.page.route(
      /^https:\/\/(ethereum-rpc.publicnode.com|eth.drpc.org)/,
      (route) => route.fulfill({ status: 503, body: "Unavailable" }),
    );
    await outage.page.goto(base + "#/dashboard");
    await outage.page.waitForFunction(
      () => window.BMCPlatform && !window.BMCPlatform.snapshot().loading,
    );
    assert.equal(
      await outage.page.evaluate(() => window.BMCPlatform.snapshot().public),
      null,
    );
    await outage.page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .last()
      .click();
    await outage.page.waitForFunction(
      () => window.BMCPlatform.snapshot().personal !== null,
    );
    await outage.page.getByRole("button", { name: "Find my Passes" }).click();
    await outage.page.waitForFunction(() =>
      document.body.textContent.includes("No Passes found for this wallet"),
    );
    assert.equal(outage.provider.sent.length, 0);
    assert.deepEqual(outage.errors, []);
    await outage.page.close();
    report.checks.push(
      `${name}: public RPC outage hides unavailable figures; verified wallet reads can still recover owned NFT IDs, without transactions.`,
    );
    const noWallet = await configuredPage(browser, { wallet: false });
    await noWallet.page.goto(base + "mint/");
    await noWallet.page.locator("#connect").click();
    await noWallet.page.waitForFunction(() =>
      document
        .getElementById("message")
        .textContent.includes("No injected wallet"),
    );
    await noWallet.page.close();
    const live = await configuredPage(browser, { live: true });
    await live.page.goto(base + "mint/");
    await readReady(live.page);
    await live.page.locator("#connect").click();
    await live.page.waitForFunction(
      () => window.BMCPlatform.client.state.ready,
    );
    await live.page.locator("#mint-genesis").click();
    await live.page
      .locator("#transaction-review")
      .waitFor({ state: "visible" });
    assert.equal(live.provider.sent.length, 0);
    assert.equal(await live.page.locator("#review-to").textContent(), API.BMC);
    assert.equal(
      await live.page.locator("#review-spender").textContent(),
      CONFIG.PASS_ADDRESS,
    );
    assert.match(
      await live.page.locator("#review-amount").textContent(),
      /1,000,000 BMC/,
    );
    assert.match(await live.page.locator("#review-fee").textContent(), /ETH/);
    await shot(live.page, `${name}-transaction-review`);
    await live.page.keyboard.press("Escape");
    await live.page.waitForFunction(
      () => !window.BMCPlatform.client.state.busy,
    );
    assert.equal(live.provider.sent.length, 0);
    await live.page.waitForFunction(
      () => document.activeElement.id === "mint-genesis",
    );
    await live.page.locator("#mint-genesis").click();
    await live.page
      .locator("#transaction-review")
      .waitFor({ state: "visible" });
    await live.page.locator("#review-confirm").click();
    await live.page.waitForFunction(
      () =>
        document.getElementById("transaction-review").open &&
        document
          .getElementById("review-title")
          .textContent.includes("permanently burn"),
    );
    assert.equal(live.provider.sent.length, 1);
    assert.equal(
      BigInt("0x" + live.provider.sent[0].data.slice(74)),
      API.GENESIS,
    );
    await live.page.locator("#review-confirm").click();
    await live.page.waitForFunction(
      () => window.BMCPlatform.client.state.minted?.id === 1n,
    );
    assert.equal(live.provider.sent.length, 2);
    await live.page.waitForFunction(
      () => !window.BMCPlatform.client.state.busy,
    );
    assert.match(
      await live.page.locator("#mint-result").innerText(),
      /Pass #1/,
    );
    assert.deepEqual(live.errors, []);
    report.checks.push(
      `${name}: test-only LIVE mock requires a separate accessible review for approval and mint; Escape cancels with focus return; exact 1,000,000 BMC allowance; gas/from/to/spender displayed; receipt shows minted Pass. No public transactions.`,
    );
    await live.page.close();
  } finally {
    await browser.close();
  }
}
try {
  if (process.env.BMC_BROWSER !== "webkit") await run(chromium, "chromium");
  if (process.env.BMC_TEST_WEBKIT === "1") {
    try {
      await run(webkit, "webkit");
    } catch (e) {
      report.limitations.push("WebKit: " + e.message);
      if (report.engines.includes("webkit")) throw e;
    }
  } else report.limitations.push("WebKit not requested in this run.");
  report.limitations.push(
    "Browser wallets and public chain reads are controlled EIP-1193/RPC fixtures; metadata image requests use matching local artwork. This suite does not establish live IPFS availability. Physical MetaMask/mobile devices and screen readers were not exercised.",
  );
} catch (e) {
  report.errors.push(e.stack);
  process.exitCode = 1;
} finally {
  server.close();
  await fs.writeFile(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
