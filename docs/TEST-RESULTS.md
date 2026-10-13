> Historical contract-adaptation record, retained from the prior revision. For the 2026-10-13 website release, read [VALIDATION.md](VALIDATION.md) and [WEBSITE-SECURITY.md](WEBSITE-SECURITY.md). The NFT address is now configured for labeled read-only data; public writes remain locked because the two deployment records disagree. Reveal now requires a separate user action. No contract change or deployment was made by this website task.

# Adaptation verification results

Checked locally on 2026-10-12 UTC (2026-10-13 in Europe/Berlin for the final run).
Foundry 1.8.3, Solidity 0.8.26, the project's existing configuration, Node 24.21.0 and Python 3.13.5.
No new build dependency, external package installation or network-dependent offline test was added.
These are contributor checks, not independent audit approval or deployment authorization.

| Check | Result |
| --- | --- |
| `forge build` | PASS. No configuration/dependency changes. |
| `forge build --sizes` | `BMCIlluminatiPass`: runtime 21,458 bytes; initcode 22,353 bytes before two constructor words. EIP-170 margin 3,118 bytes. |
| `forge test` | PASS: 46 tests, 0 failures, 2 explicitly skipped mainnet-fork cases on the empty offline chain. Includes 64 fuzz cases under the existing configuration. |
| Held proof `Proof_cfb1eeea80d0.t.sol` (copied to scratch) | FAILED on the accepted tree (`attempts needed: 13`, Genesis #41 taken); PASS on this tree: 300 in-block attempts obtain nothing and burn nothing. |
| Supplied `Contracts.protected.t.sol` | PASS: exact protected harness copied temporarily into scratch, supplied with locally derived CREATE2 arguments. Constructor, runtime presence/size and forbidden-opcode check all pass. No manifest written. |
| `forge test --match-contract BMCMainnetForkTest --fork-url <contributor mainnet RPC> --fork-block-number 26179236 -vv` | PASS: both Genesis and Mystery tests against the real BMC token, including the closed-then-opened launch gate on chain 1 and a settled reveal. Only the local fork's test buyer balance was adjusted; no mainnet transactions. |
| `node --test test/website/*.test.cjs` | PASS: 38 tests, 0 failures. Includes an isolated Anvil full 500-mint integration with the owner opening the gate and all 460 Mystery passes revealed, about 34 seconds. |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s test/tools -p 'test_*.py'` | PASS: 3 tests. Artwork report/PNG corruption cases and actual localhost HTTP routes/assets. |
| `python3 script/export_website_abi.py --check` | PASS: checked-in NFT and BMC ABIs/selectors exactly match the Foundry build. |
| `python3 script/verify_genesis.py` | PASS: 77/77 HTTP GETs returned valid PNGs with expected filenames. `docs/genesis-verification.json` records status, content type, byte count, dimensions and unique SHA-256 for every file. Network only for this explicit verification command. |
| Homepage preservation | PASS: original compiled JS/CSS, icons and OG image hashes match. Removing only the two new navigation tags from the delivered root HTML reproduces the original HTML hash. |
| `node --check` for authored browser scripts | PASS. |
| `git diff --check` | PASS. |

## Application regressions covered

- Explicit owner supplied by the factory; nonpayable/static constructor deploys without BMC code.
- Known immutable CID, no remaining setter/VRF callback/finalization configuration surface, and
  both phases continue even if ownership is renounced before the first mint.
- Eleven Mystery buyers are settled by a third party without a coordinator or funding
  dependency, even when the head token's owner never reveals. A later mint still works after a
  year/block advance.
- A selective contract caller (fresh helper per attempt, revert unless Genesis) obtains nothing in
  300 in-block attempts and burns nothing; reveal waits for the block after the mint; the outcome
  is identical whoever reveals and whenever within the window; reveals are in mint order and
  batched; an expired window settles as Standard, and as Genesis only once no Standard remains;
  the EIP-2935 path gives the same outcome as the native path; pending metadata is neutral and
  final metadata permanent; a reverted reveal cannot re-roll.
- Launch gate: closed on chain 1 until the owner opens it, owner-only, one-way, no close/pause
  surface, survives renunciation; open from construction on rehearsal chains.
- Exactly 40 sequential Genesis mints, Legendary #1, then 460 Mystery mints; phase/sold-out
  boundaries, correct prices, exact allowance consumption, BMC balance and total-supply burns.
- Reentrant receiver failures, including a call across the Genesis/Mystery boundary, roll back
  the entire mint/burn. Wrong-decimal and fake-burning tokens are rejected.
- Inventory uniqueness and complete 77 Genesis/423 Standard allocation; full sellout under
  changing entropy and repeated same-block minting. Metadata persists across blocks/transfers.
- Existing StandardArt uniqueness, trait coverage, SVG generation and ERC-721 transfer behavior.
- Empty-chain dependency use fails clearly and block zero does not underflow hash selection.

## Website regressions covered

- Shipped pre-launch state permits wallet connection and BMC balance reads, with no write even
  when disabled click handlers are invoked directly. Merely adding an NFT address is insufficient.
- Every independent live-gate field is required; empty/zero/dead/BMC addresses and deterministic
  design markers are rejected. Bytecode, token decimals and inconsistent contract state fail closed.
- Wrong chains, account/chain/disconnect changes, connection refusal, overlapping wallet events
  and a closed connection cannot accidentally resume a mint.
- Exact single-price approval, confirmation before mint, sufficient allowance skipping approval,
  failed/rejected/reverted/pending approval stopping mint, and changed phase/balance/bytecode
  after approval stopping the flow.
- Pending state survives a page-instance reload through browser storage; rechecks send no new
  transaction. Reorged receipts remain pending. Double-clicks cannot start concurrent flows.
- Mint outcomes come from real receipt logs; safe tokenURI decoding handles both IPFS PNGs and
  base64 on-chain SVGs. Unsafe metadata URLs are rejected without a substituted image.
- Gas-estimation headroom covers the normal more-expensive Mystery storage branch, which was
  encountered in local full-sellout testing.
- The full Anvil integration uses actual compiled bytecode, the generated ABI and browser mint
  client for both phases. It opens the gate as the owner, mints all 500, reveals every Mystery pass
  after its reveal block, decodes every artwork URI, observes 37 distinct Mystery Genesis PNGs and
  423 distinct Standard SVGs, and confirms 201,000,000 BMC removed from supply with no BMC retained.
- Mint client: the Mystery flow sends a separate reveal after the block following the mint; a
  reveal that stays pending marks the pass unrevealed, locks the page and recovers without
  resending; a closed on-chain gate blocks every write; unreconciled pending counts fail closed.
- All 77 preview URLs, image error disclosure, initial disabled buttons, navigation injection,
  preserved existing routes/assets and `/mint` → `/mint/` HTTP resolution.

## Limits

No actual mainnet NFT address exists in this delivery. Mainnet NFT verification, deployed runtime
comparison, validation of that future deployment and public-mint approval are pending. The BMC
fork tests validate the real payment token's behavior, not a deployed NFT collection.

The tests used simulated EIP-1193 providers and local Anvil accounts, not a real MetaMask extension
or a user's account. No pixel/visual browser test, mobile wallet app test, Slither or Mythril run
was performed. DOM/HTTP tests do not prove browser layout or wallet-vendor compatibility. IPFS
availability is a point-in-time observation. The remaining block-randomness risk (reveal-block proposer bias) is
not fixed by passing these tests. No live site publication or paid service was executed.
