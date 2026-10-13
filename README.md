# BMC Illuminati Web3 website

The existing BMC site now has a shared wallet connection, read-only Ethereum dashboard, authentic
NFT galleries, an explicit transaction-confirmation flow, and a prepared staking interface.
**This is a PRE_LAUNCH release. Approvals, minting, reveals and staking deposits are disabled.**
The complete static delivery is `dist/`; the IMD publisher serves that committed export.

## What works

- Voluntary MetaMask / injected EIP-1193 connection and EIP-6963 wallet selection. Account and
  network changes, Ethereum switching, rejection messages and interface disconnect are handled.
- Live BMC balance, ETH balance, NFT count, collection supply/price/burn statistics and bounded
  ownership lookup. Failed reads show unavailable states, never fabricated balances or rewards.
- Collection and mint pages with all 77 real Genesis previews, 12 Standard SVG previews generated
  by the unchanged on-chain renderer, original IPFS links and minted `tokenURI` lookup.
- Exact-amount approval, Genesis/Mystery mint, separate reveal, fee/recipient review, receipt
  tracking and pending recovery are implemented and tested behind the launch gate. Every write
  requires its own in-page review and wallet confirmation. No automatic reveal or `openMinting`.
- Staking amount entry and wallet balance work. Deposit, withdrawal and reward controls explain
  why they are disabled: no verified Mainnet staking deployment was identified in project records.
- The original home, collection, swap, staking, burns, dashboard, community, FAQs and optional
  cinematic intro remain. Swap/burn actions that were previously unavailable remain unavailable.
  Original allocation proposals are retained as historical proposals, never funded entitlements.
- Responsive black/gold styling, keyboard navigation, reduced motion, local assets, share metadata,
  GitHub/Etherscan links and visible X/Telegram confirmation status.

## Deployment discrepancy and release status

| Record | Ethereum Mainnet address | Verification at block 26186477 |
| --- | --- | --- |
| Pinned IMD deployment, used for **read-only** data | `0xedd2be808e73bc443bc12aa07586193c193e8d51` | Runtime exactly matches pinned source with BMC immutable substituted. |
| NFT address in the request | `0x92789D9bb680a2Db8617270a530E9D0f80b48641` | Different runtime; cannot authorize this address against the supplied build. |
| Existing BMC token | `0x38224239f2BDae357D47cb864BC533d7f72dF961` | Runtime matches Sourcify source; ERC-20 burn reduces balance and supply. |

Both NFT addresses reported minting closed, 0 minted and 500 remaining at that recorded block.
Those are historical verification results, not hardcoded live statistics. The site visibly explains
which deployment its live reads concern. It never silently selects the requested contract for writes.
Etherscan returned HTTP 403, so NFT explorer source verification remains unconfirmed.

The staking repository found through the existing project record explicitly describes source-only,
undeployed work. No Mainnet address, funded rewards, administrator/withdrawal parameters or usable
staking ABI could be authenticated. The safe fallback required by the brief is delivered.
Official X and Telegram URLs also remain unconfirmed; no third-party listing is passed off as official.

See [chain evidence](docs/CHAIN-VERIFICATION.json), [current security review](docs/WEBSITE-SECURITY.md)
and [launch handoff](docs/LAUNCH.md). Independent security approval is **not** established by our tests.
No contract was modified, deployed or redeployed; no public transaction, signature, token approval or
owner action was made. No direct hosted-site publication command was run.

## Install, build and preview

Requires Node 22 and npm. Build dependencies are only esbuild 0.25.11 and TypeScript 5.9.3, pinned
with integrity hashes in `web/package-lock.json`. React and the inherited runtime are local assets
from the original published site, whose provenance hashes remain in `docs/website-preservation.json`.
No browser runtime package, remote script CDN, private RPC credential or backend is introduced.

Install into a temporary directory so this bounded repository never acquires `node_modules` or caches.
Run from the repository root; retain `BMC_BUILD_TOOLS` in this shell for rebuilds:

```sh
BMC_BUILD_TOOLS=$(mktemp -d /tmp/bmc-build.XXXXXX)
cp web/package.json web/package-lock.json "$BMC_BUILD_TOOLS/"
npm ci --prefix "$BMC_BUILD_TOOLS" --cache "$BMC_BUILD_TOOLS/npm-cache" --no-audit --no-fund
BMC_ESBUILD="$BMC_BUILD_TOOLS/node_modules/esbuild/lib/main.js" node web/scripts/build.mjs
"$BMC_BUILD_TOOLS/node_modules/.bin/tsc" --noEmit -p web/tsconfig.json
node web/scripts/preview.mjs
```

Open `http://127.0.0.1:4173/preview/` or `/preview/mint/`. `PORT=8080` changes the preview port.
The server also supports root hosting and redirects directory URLs to their trailing-slash forms.
HTTPS (or localhost) is required for wallet operation and Web Crypto. Use a static HTTP server,
not `file://`. Previewing the existing `dist/` requires only Node, with no installation or network.
Once build tools are installed, production builds and typechecks require no network. Live balances
naturally require an Ethereum RPC; offline pages retain their navigation and local artwork.

Production entry points use relative asset URLs and existing hash routes, so gateway subpaths work:

| Route | Purpose |
| --- | --- |
| `./` | Existing ecosystem home |
| `./mint/` | Wallet, collection reads, guarded mint/reveal flow, gallery and lookup |
| `./#/pass` | Collection, real artwork tabs and retained allocation diagram |
| `./#/staking` | Disabled staking integration, amount/balance and unverified terms |
| `./#/dashboard` | Wallet balances, NFT ownership, collection data and unavailable staking rewards |
| `./#/swap`, `./#/burns`, `./#/community` | Preserved ecosystem routes and project links |

## Source and publication

`website/site.js` is the editable React application recovered from the existing compiled bundle;
`website/platform.css` applies the final shared design. `web/src/platform.ts` owns strict-typed shared
RPC/wallet state. The existing `website/config.js`, `mint-client.js`, `pass-abi.js`, `bmc-abi.js`,
`app.js` and `mint/index.html` remain the mint integration. Generated ABI files are unchanged.
The unmodified original compiled app and stylesheet stay in `website/assets/`. The production
build extracts their runtime and compiles the editable app/service into `dist/`. It fails if the
known original bundle boundary disappears rather than guessing a different dependency version.

`web/scripts/build.mjs` copies an explicit runtime asset list. Submit source, frontend manifest and
lockfile, documentation and the entire `dist/`. The IMD network then publishes that committed static
export at the existing site; it does not rebuild. Publishing HTML must not activate transactions.
No deployment configuration, Solidity source, dependency tree or Git submodule was changed.

## Artwork and the 8 MiB budget

The previous tree included about 57 MiB of duplicate full-size Genesis PNG downloads, exceeding this
assignment's complete 8 MiB bundle limit. All 77 are now represented by authentic locally bundled
WebP previews (maximum 360 px, quality 72; about 1.1 MiB total). Every corresponding source hash was
checked against the retained `docs/genesis-verification.json`; `docs/artwork-previews.json` records
both original and preview hashes. The full-size originals remain at the unchanged immutable IPFS CID
`bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u` and are linked from both galleries.
The contract, metadata and filenames have not changed. No artwork option is omitted or replaced.
See [asset delivery notes](artwork/genesis/README.md). Pillow is needed only to regenerate previews
with `script/optimize_artwork.py`, not to build or run the website.

## Validation

The review revision fixes header/mobile-menu wallet errors, clarifies the Genesis fallback after
Mystery expiry, and starts the planned-slot preview at eight while retaining all 500 slots.
Revision-specific reproduction evidence, current checks and limitations are recorded at the start
of [docs/VALIDATION.md](docs/VALIDATION.md). Build and preview commands above remain unchanged.
Run `forge build --offline` before `node --test test/website/*.test.cjs`: the existing local Anvil
integration requires the generated contract artifacts. Browser regressions are part of
`test/website/browser-validation.mjs`, using the external Playwright setup described in validation.

The current results and limitations are in [docs/VALIDATION.md](docs/VALIDATION.md); the implemented
design and Better Interface review are in [DESIGN.md](DESIGN.md). Checks actually performed include:

- Production build and strict TypeScript check; regenerated ABI freshness check.
- 43 Node tests, including a complete 500-mint local Anvil integration and wallet/security regressions.
- 3 Python checks. Offline Foundry: 80 passed, 4 explicitly skipped (fork-only). An additional local
  fork of the deployed pinned NFT/BMC passed both Genesis and Mystery/burn/reveal tests.
- Chromium and WebKit interaction tests at 320, 390, 768 and 1440 px; all passed. Wallet/RPC fixtures
  were used in browser tests, with no public sends. Physical MetaMask and screen readers were not tested.
- The pinned design-critic probe passed 16/16 checks. The product and primary action are visible in
  the first 390 px-wide viewport. Screenshots were inspected locally.
- Slither reported **three inherited High findings**; these remain for independent contract review.
  `forge fmt --check` reported one inherited blank-line difference in untouched `script/Deploy.s.sol`.
  Neither result is described as passing; protected contract/dependency/config files were preserved.

Re-run the main checks (Foundry 1.8.3 / cached solc 0.8.26 required for contract tests):

```sh
forge build --offline
python3 script/export_website_abi.py --check
node --test test/website/*.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test/tools -p 'test_*.py'
forge test --offline
python3 script/verify_website_deployment.py
forge test --match-contract DeployedWebsiteForkTest --fork-url https://ethereum-rpc.publicnode.com --fork-block-number 26186477 -vv
```

The last two commands require historical Mainnet reads; an archive endpoint can be supplied to the
verification script with `--rpc`. The tests impersonate the owner **only inside a local fork** and
never broadcast. Browser test setup/commands and the pinned visual probe are documented in the
validation report. Historical adaptation and test documents remain labeled as prior-release records.
