# Website validation — 2026-10-13

All results below are checks actually run by the implementing contributor. They do not have
independent audit authority. Public funds remain disabled in the delivered configuration. No live
mint, token approval, reveal, staking transaction, contract deployment or hosting mutation was sent.

## Build and integrity

| Check | Actual result |
| --- | --- |
| Clean temporary install from `web/package.json` + `web/package-lock.json`, `npm ci --no-audit --no-fund` | PASS, three platform-relevant build packages installed outside the repository. No runtime CDN dependency. |
| `BMC_ESBUILD=<installed esbuild>/lib/main.js node web/scripts/build.mjs` | PASS, final `dist/` 1,822,810 bytes. Explicit runtime asset list, relative entry URLs. |
| `tsc --noEmit -p web/tsconfig.json` | PASS in the existing tool environment and again with the clean lockfile install. Strict TypeScript covers the shared service; inherited plain JavaScript is covered by syntax/build and interaction tests, not fully type-annotated. |
| `python3 script/export_website_abi.py --check` | PASS; generated frontend ABI files match unmodified configured Foundry build. |
| `node --test test/website/*.test.cjs` | PASS: 43 tests, zero failures/skips; 21.75 seconds in final run. |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test/tools -p 'test_*.py'` | PASS: 3 tests, including serving the production root/mint assets and artwork report checks. |
| Preview server smoke test using `node web/scripts/preview.mjs` | PASS: six root/subpath pages/assets returned 200; `/preview`, `/mint`, `/preview/mint` redirected to slash URLs; missing file returned 404. |
| Prospective submitted tree | 7139018 bytes across 602 files; below the 8,388,608-byte limit. Deleted duplicate reference PNGs excluded; all required source/runtime previews included. |
| Original published application/CSS/identity hashes | PASS via the Node preservation test against `docs/website-preservation.json`; the new source builds on the original application. |
| All 77 Genesis preview hashes and 12 Standard SVG files | PASS; original/preview mapping retained and identical source/export assets checked. No artwork option omitted. |

The installation uses `/tmp`; neither `node_modules`, npm caches nor dependency archives enter the
source bundle. The installed tools allow offline builds/typechecks. Public chain reads are separate
runtime requests and show unavailable data if offline. Existing contracts, Foundry configuration,
locks/remappings and `lib/` remain unchanged. No ignore file or Git submodule was introduced.

## Contract evidence and testing

| Check | Actual result and scope |
| --- | --- |
| `forge build --offline` | PASS with the existing compiler and dependencies. |
| `forge test --offline` | 80 passed, 0 failed, 4 explicitly skipped across 84 tests; includes existing fuzz/invariant coverage. Skips are fork-only tests. |
| `forge test --match-contract DeployedWebsiteForkTest --fork-url <provided Ethereum relay> --fork-block-number 26186477 -vv` | PASS: 2 tests, 0 skipped. Owner impersonation and test funding only in a local fork; never a broadcast. |
| `python3 script/verify_website_deployment.py --rpc <provided Ethereum relay>` | PASS for source-pinned NFT and BMC; reports requested NFT runtime mismatch. Canonical ABI matched pinned attestation. Public source: `https://ethereum-rpc.publicnode.com`. |
| Sourcify BMC source/runtime comparison | Matched the RPC runtime and recompiled source bytes; source is ERC20 + ERC20Burnable with fixed initial supply. |
| Etherscan source inspection | BLOCKED by HTTP 403 for both NFT addresses and BMC. Explorer verification remains false. |
| `forge fmt --check` | FAIL: inherited missing blank line at `script/Deploy.s.sol:12`. That file is byte-identical to the supplied commit and was not changed. The new fork test was formatted. |
| `slither . --exclude-informational --exclude-optimization --exclude-low --exclude-medium` | FAIL, exit 255: 3 inherited High findings (`weak-prng`, `incorrect-exp`, `reentrancy-balance`). Locations and contextual assessment in `WEBSITE-SECURITY.md`. No suppression or forbidden source/dependency change. |

The local deployed-fork tests prove that the pinned contract initially rejects closed minting; an
owner action on that private fork opens it; exact-price Genesis and Mystery burns reduce payer BMC
and total supply, consume exact allowance, leave no BMC in the NFT contract and mint to the payer.
They cross Genesis 40/Mystery 41 and settle a pending Mystery with a controlled future-block fixture.
The local Anvil integration additionally mints all 500 passes, reveals all Mystery entries, verifies
37 Mystery Genesis plus 423 Standard, uniqueness and metadata. These tests do not validate the
request's different NFT deployment, production randomness fairness or public release authorization.

No authenticated staking address was supplied/found in project records. Real staking deposit,
withdrawal and reward accounting tests therefore **could not be performed**. The implemented and
exercised fallback keeps those four actions disabled and reports terms/rewards as unavailable.

## Browser interactions on the actual export

The committed `test/website/browser-validation.mjs` serves `dist/` under `/preview/`, uses the real
production HTML/scripts/styles, and tests both Chromium and WebKit. Its injected-wallet/RPC fixtures
return recorded public runtime bytes and deterministic contract states. Only a separate mock test
intercepts `config.js` in memory to exercise LIVE review dialogs; the delivered config stays locked.
IPFS metadata-image requests use the corresponding local authentic artwork fixture. These tests
neither broadcast nor establish remote image gateway availability.

Both engines passed, with zero unexpected script, console or local-resource errors:

- Home, Pass, Staking, Dashboard, Swap, Burns and Community at 320, 390, 768 and 1440px, without
  horizontal page overflow. Product/main action visible on the first 390px screen.
- Initial load makes no wallet RPC call. Keyboard Skip to content and menu Enter/Escape work.
- Genesis/Standard tabs, actual image decode and keyboard “Show more artwork” work.
- Staking amount entry works; approval, deposit, withdrawal and claim remain disabled.
- Missing wallet, rejected connection, successful connection, account changes, wrong network,
  Ethereum switch and disconnect produce appropriate UI state and no transaction.
- Forced mint/reveal calls against production PRE_LAUNCH config still cannot send.
- Not-yet-minted lookup and empty ownership search show honest results; RPC outage hides public
  figures while verified wallet reads can still find owned Passes.
- Mock LIVE approval shows sender/BMC recipient/NFT spender/exact 1,000,000 BMC/estimated ETH fee;
  Escape cancels with focus returned. Confirmed approval requires a second in-page mint review.
  Two mock wallet sends and canonical receipts display the minted Pass.
- A root 200% CSS text-size check and RTL-direction sanity check do not overflow. These are not
  native browser zoom, a translation review, or exhaustive large-text tests on every route.

The 43 Node tests add meaningful failure paths: wrong/missing code, closed gate, insufficient funds,
phase changes, rejection/revert, double clicks, account/network/code changes during review, unsafe
metadata, explicit-only reveal, reorgs, pending persistence and reload with unknown send outcome.
A regression specifically tests a reload while the wallet confirmation is still open; the stored
submission lock prevents a second request, while explicit wallet rejection clears it.

Reproduction with optional browser tools outside this repo:

```sh
BMC_BROWSER_TOOLS=$(mktemp -d /tmp/bmc-browser.XXXXXX)
npm install --prefix "$BMC_BROWSER_TOOLS" --cache "$BMC_BROWSER_TOOLS/npm-cache" --no-audit --no-fund @playwright/test@1.56.1
PLAYWRIGHT_BROWSERS_PATH="$BMC_BROWSER_TOOLS/browsers" "$BMC_BROWSER_TOOLS/node_modules/.bin/playwright" install chromium webkit
PLAYWRIGHT_BROWSERS_PATH="$BMC_BROWSER_TOOLS/browsers" BMC_PLAYWRIGHT="$BMC_BROWSER_TOOLS/node_modules/playwright/index.mjs" BMC_TEST_WEBKIT=1 node test/website/browser-validation.mjs
```

The browser host needs Playwright system libraries. On this worker, Chromium was usable directly;
WebKit initially lacked shared libraries. Libraries were extracted only under `/tmp`, after which
WebKit ran the full suite successfully. Initial WebKit preview then exposed CSP upgrading localhost
assets to HTTPS; removing that redundant directive fixed preview without permitting external scripts.
Every configured production external URL already uses HTTPS. No system/dependency changes were
placed in the repository.

`test/scratch/browser/results.json` and screenshots were produced by this script and inspected:
home/collection/staking/mint at 390, mint/dashboard at 1440 and the transaction review. The final
390px home screenshot clearly shows product description, mint CTA, secondary navigation and real
Genesis art; the standalone mint shows Connect Wallet in its initial viewport. Scratch screenshots
are intentionally excluded from submission and can be recreated by the command above.

## Better Interface and design-critic review

The pinned Better Interface workflow, all six core domains, supporting sections and design
system-documentation guidance were read and applied during implementation. `DESIGN.md` records the
implemented tokens/components/breakpoints and guidance attribution. The pinned probe was run after
the final source changes:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/bmc-browsers IMD_PLAYWRIGHT=/tmp/bmc-tools/node_modules/playwright/index.mjs node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

**Result: 16/16 passed.** The probe reported no script/missing-local-file failures, page overflow,
text overlap/occlusion, failing measured text contrast, small tracked capitals, repeated helper
lines, excessive type sizes/families, ornamental card nesting/gradient text, or endless reduced-motion
animation. Title/favicon/description/og:title/og:image are present. It measured five font sizes per
viewport, three families and three weights. All 27 measured controls meet 24px/spacing requirements;
10 are smaller than the comfortable 44px recommendation. First-screen prose was 10 words at both
390 and 1440 (61/86 total words), below the guide's budget.

Screenshots were written to `test/scratch/taste/shots/390.png`, `390-full.png`, `1440.png` and
`1440-full.png`. The root probe used the configured public read RPC; unavailable external reads
remain a supported UI state. The probe evaluates only the entry page, so route-specific browser
checks above supplement it.

| Domain | Coverage, findings and fixes in final source |
| --- | --- |
| Accessibility | `website/site.js:3272`: initial auto-focus skipped the skip link; focus now moves only on route changes. `website/app.js:211`: cancelling a dialog returned focus before the triggering button was re-enabled; focus is restored after flow cleanup. Both regressions pass in Chromium/WebKit. Labels, live statuses, native dialog, image alt text, reduced/forced-color styles and focus checked in source/rendering. |
| Layout | `website/platform.css:565`, `website/styles.css:487`: compact mobile header/hero, wrapping addresses, two-column artwork, single-column forms keep product/action above the fold. Seven root routes at four widths and mint mobile/desktop passed overflow checks. `web/scripts/preview.mjs`: root-path guard and directory redirects repaired and smoke-tested. |
| Writing | `website/site.js:245` and `website/mint/index.html`: conflicting deployments explicitly named. `website/site.js:432`: no invented staking reward/lock data. `website/site.js:1081`: duplicate wallet helper line removed from header, changing the probe from 15/16 to 16/16. Source-only proposals remain explicitly labeled. |
| Typography | `website/platform.css:28`, `website/styles.css:37`: shared 14/16/20/24/36/56 scale, system prose, serif display and monospace addresses. Final root probe passes casing/tracking/type-size/family/weight checks. |
| Colors | `website/platform.css:2`, `website/styles.css:1`: final black/gold tokens, readable warm text, visible focus/error/control boundaries. Solid-pair contrast calculation and rendered probe recorded in DESIGN.md. Color never substitutes for transaction status wording. |
| UI | `website/mint-client.js:614`: mandatory transaction review and post-review verification; `:651`: persisted pre-send lock covers reloads. `website/app.js:246`: native review callback. `website/site.js:310`: authentic gallery and tabs; `:432`: useful disabled staking form; `:576`: real wallet dashboard. Network/error/unavailable and pending/rejection paths exercised. |

The parent guide's six domains were covered both in source and representative rendered states.
Not every inherited informational paragraph/state was manually scrutinized. Physical iOS/Android,
real MetaMask/other extensions, hardware wallets, screen readers, high-contrast operating-system
modes and native browser zoom were not tested. WebKit is an engine test, not a claim of Safari/device
certification. The legacy optional intro was preserved rather than fully re-audited. No automatic
visual/security result is described as an absolute guarantee.

## Delivery limitations

- NFT deployment identity still requires authoritative reconciliation; the requested address's
  source is unestablished and Etherscan verification could not be completed.
- Three inherited Slither High results and one formatting difference are explicitly unresolved.
  Independent security review and public-mint authorization remain required.
- No verified staking deployment/funding/withdrawal rules; all fund actions remain unavailable.
- No authenticated official X/Telegram links; visible confirmation states remain.
- Live RPC and full-size IPFS availability are external dependencies. Browser fixture tests do not
  prove future uptime; local previews, source, ABI and runtime assets are complete.
- Transaction replacement hashes cannot be inferred safely. Unknown outcomes stay locked; storage
  removal or another browser can bypass local duplicate protection.
- The worker prepares the static export; the IMD publication process serves the committed result.
  This task did not claim a completed remote publication or run a publishing/deployment command.

These limitations are reflected in the actual UI and launch configuration, rather than hidden
behind apparently active financial buttons. The usable read-only site is the authorized safe
fallback while those external release prerequisites remain open.
