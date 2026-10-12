# BMC Illuminati Pass adaptation

## Delivery and scope

This submission delivers the requested **pre-launch** integration and a factory-compatible
candidate block-random Mystery contract. It does not deploy, broadcast, publish the hosted site,
request real wallet signatures, change token permissions or activate public minting. The NFT
address remains intentionally unset, as the brief permits. The finalized source revision and
actual deployment must be confirmed separately before using LIVE mode; see `docs/LAUNCH.md`.

The existing Foundry configuration, dependencies/remappings, `lib/`, `.github/`, `.git/`, environment
files and package/lockfiles were not changed. No launch token, pool, proxy, external library,
submodule, downloaded build dependency or `launch.json` was added. The preserved website assets
are ordinary files already published by the requester, with no package/build changes.

## Revision after independent review (2026-10-12)

The accepted first round was reopened with two reproducible findings and one advisory note. Each
was reproduced on the accepted tree before anything changed; the held proof
`Proof_cfb1eeea80d0.t.sol` failed there (`attempts needed: 13`, Mystery Genesis #41 taken for one
price) and passes on this tree. Answers are in `.imd-responses.json`.

| Files | Change | Finding or rule |
| --- | --- | --- |
| `src/BMCIlluminatiPass.sol` | Mystery is now commit-reveal. `mintMystery` burns, records the mint block, issues the pass as `Tier.Pending` and no longer derives any entropy. `reveal(maxCount)`, callable by anyone, settles pending passes **in mint order** from `blockhash(mintBlock + 1)` mixed with the collection address and token id; `msg.sender`, `prevrandao` and `timestamp` are no longer inputs. The outcome therefore does not exist while the burn can still be rolled back, so observe-and-revert (contract callers), simulate-then-send (EOAs) and re-rolling by fresh helper contracts all stop working. Reverting a reveal changes nothing. | `cfb1eeea…` (high). The reviewer's minimal fix shape was followed. |
| `src/BMCIlluminatiPass.sol` | Reveal window: the hash is read natively for 256 blocks and through the EIP-2935 history contract (`0x0000F908…2935`, mainnet since Prague) up to 8,191 blocks (~27 h). After that, or if the history contract is absent, `reveal` settles the pass as **Standard** (Genesis only when no Standard slot remains). This is the documented fallback: because waiting can only make an outcome worse, a holder gains nothing by withholding a reveal, and in-order settlement means a holder cannot time a reveal against other buyers' reveals either. Nobody can be stuck: anyone can always settle the head of the queue. | `cfb1eeea…`; keeps the imported head-of-line finding `25dd4906…` resolved. |
| `src/BMCIlluminatiPass.sol` | Neutral "Unrevealed" on-chain metadata for pending passes; `revealStatusOf`, `pendingReveals`, `revealBlockOf`, `revealDeadlineOf`, `nextRevealId` views; `MysteryMinted` carries the reveal block and `Revealed` a `forced` flag. | Needed by the website and indexers to show the pending state honestly. |
| `src/BMCIlluminatiPass.sol` | Launch gate: `mintingOpen` is false from construction on chain id 1 (Ethereum Mainnet and forks of it) and both mint functions revert `MintingNotOpen` until the explicit owner calls `openMinting()` once. The call is one-way: nothing can close, pause or restrict minting afterwards, and it survives `renounceOwnership`. On any other chain id the contract is open from construction, so rehearsal chains, the independent reviewer's held proof (which constructs with two arguments and mints in its `setUp`) and local tooling keep working. Constructor signature `(initialOwner, bmcToken)` is unchanged. | `b5ce1446…` (medium), option (a). Chain-scoping was required because the held proof must pass on a fresh two-argument construction; the gate is what matters on the launch chain and forks of it. |
| `test/BMCIlluminatiPass.t.sol` | Added the selective-caller regression (Hunter/Picker, 300 in-block attempts obtain nothing and burn nothing), reveal timing/order/batching, outcome independence from caller and time (snapshot comparison), expired-window Standard fallback, Genesis-only exhaustion, EIP-2935 path via an etched mock, pending metadata neutrality and permanence, reverting-reveal no-reroll, launch-gate open/close/renounce cases and block-zero behaviour. Existing mint-out, uniqueness, reentrancy, burn, metadata and audit regressions were adapted to the two-step flow (`vm.setBlockhash` supplies the reveal hashes). | Every change is tested. |
| `test/FactoryCompatibility.t.sol`, `test/BMCMainnetFork.t.sol` | The chain-1 rehearsal now checks the gate is closed, opens it as the owner, and (fork) reveals the real-BMC Mystery mint. Both fork tests pass against the real token at block 26,179,236. | Launch gate and reveal on the launch chain. |
| `website/pass-abi.js` | Regenerated from the build (new ABI hash recorded in the file). | ABI changed. |
| `website/mint-client.js` | Reads `pendingReveals()` and `mintingOpen()` with the pinned stats, reconciles pending passes into the inventory check, refuses every write while the contract is not opened, and after a Mystery mint waits for the block after the mint block, then sends `reveal(count)` as a separate wallet transaction (bounded to 50) and shows the pass as "awaiting reveal" until settled. A `reveal()` action settles anyone's pending passes; pending reveal transactions persist and recover like approvals/mints. | Website must follow the two-step contract and the on-chain gate. |
| `website/app.js`, `website/mint/index.html` | Pending-reveal stat, "Reveal pending passes" button, "Not opened yet" phase label, Mystery copy and risk disclosure rewritten for commit-reveal (proposer bias of the reveal block, 27-hour window, Standard fallback, no preview/revert), explicit note that Mystery opens only after all 40 Genesis sell, owner power described as the one-way opening. | Honest disclosure required by the brief; advisory `7c97fe79…`. |
| `test/website/*` | Harness models pending reveals, the gate and the reveal transaction; new client tests for the reveal flow, a reveal that stays pending, closed gate, and unreconciled pending counts; the Anvil integration opens the gate as the owner and reveals every one of the 460 Mystery passes before decoding its metadata. | Every change is tested. |
| `README.md`, `docs/*.md`, this file | Updated to the two-step flow, the gate and the new verification results. | Required notes. |

Not changed: prices, supply split, sequential Genesis phase, exact `burnFrom` verification, Standard
on-chain art, ERC-721 behaviour, constructor arguments, build configuration and dependencies.

## Changes and reasons

| Files | Change | Requirement or reproduced finding |
| --- | --- | --- |
| `src/BMCIlluminatiPass.sol` | Constructor reduced from three addresses to `(initialOwner, bmcToken)`. Retains explicit ownership, nonpayable construction and no constructor external calls. Validates BMC code on first mint. | Factory supports static, fully configured constructors on an empty chain; never assign ownership to factory/tx.origin. |
| `src/BMCIlluminatiPass.sol` | Pins the supplied Genesis CID as a public constant; removes CID setter, lock and mint gates. | Known CID cannot be a dynamic factory argument; no post-deployment initialization. Fixes imported CID blocker and its JSON-injection surface. |
| `src/BMCIlluminatiPass.sol` | Replaces VRF configuration, requests, stored words, callbacks and finalization queue with block-derived draws (first round: immediate; this revision: commit-reveal, see above). Retains the original O(1) Fisher-Yates inventory and metadata assignments. | Brief explicitly requires block-derived randomness instead of VRF. Fixes configuration/subscription dependency and head-of-line reveal blocking. |
| `src/BMCIlluminatiPass.sol` | Keeps numeric tier/reveal enum values for view compatibility. Mystery mint returns only the token ID; its event no longer contains a request ID. (Revision: `pendingReveals()` now counts passes awaiting `reveal`.) | There are no coordinator requests in the chosen design. ABI changes are intentional and regenerated. |
| `src/BMCIlluminatiPass.sol` | Documents manipulation risk in NatSpec. Guards block zero when reading the previous hash. | Required honest randomness disclosure; empty-chain/fuzz edge cases. |
| `script/Deploy.s.sol` | Removes coordinator config and broadcast mode, retaining the mainnet BMC constant and explicit-owner simulation helper. | New two-argument constructor; worker must not broadcast. |
| `test/BMCIlluminatiPass.t.sol` | Retains burn, ERC-721, artwork, cap, uniqueness and reentrancy coverage; replaces VRF-only behavior tests with immediate-reveal and immutable-CID regressions. Adds constructor, year-later liveness, metadata permanence, block-zero and cross-phase reentrancy cases. | Behavior changes are limited to requested randomness and factory/audit fixes, with corresponding tests. |
| `test/ChainlinkMockIntegration.t.sol`, `test/mocks/MockVRFCoordinator.sol` | Removes now-inapplicable VRF-only integration tests and mock. Vendored Chainlink files are untouched. | Contract no longer depends on VRF or its callback gas, funding and consumer-registration behavior. |
| `test/BMCMainnetFork.t.sol` | Updates constructor, removes CID/VRF setup, adds a real BMC Mystery-burn fork case. Explicitly skips on an empty offline chain. | Original standalone fork test failed plain `forge test`; verifier has no network. Fork cases are separately executed against the supplied machine RPC. |
| `test/FactoryCompatibility.t.sol` | Rehearses CREATE2 construction using the given owner/BMC, with no BMC code. Checks runtime/initcode limits, explicit owner and forbidden opcodes. | Factory acceptance requirements. |
| `website/index.html`, `website/assets/*`, `website/favicon*`, `website/og.png` | Preserves the live existing site's original HTML and published assets, with only two added navigation asset tags in HTML. | Checkout contained a standalone NFT mint page, not the existing ecosystem site's editable source. Preserve the actual live site instead of rebuilding/redesigning it. |
| `website/mint-nav.js`, `website/mint-nav.css` | Adds one prominent `MINT BMC PASS` link to the original header. Existing actions/routes stay intact. Mobile wrapping accommodates the added link. | Dedicated `/mint` navigation without replacing existing site content/functionality. |
| `website/mint/index.html`, `website/styles.css` | Adds the dedicated responsive black-and-gold mint page using the original mint stylesheet as its base. Includes wallet details, actual contract metrics, two mint phases, price, transaction/NFT views, all 77 artwork previews and links. Buttons disabled in initial HTML. | Full mint UI plus PRE-LAUNCH mode. No fabricated minted, supply-remaining or burn totals. |
| `website/config.js` | Adds PRE_LAUNCH/LIVE separation, unset NFT address, explicit deployment/review/authorization record, supplied CID and gateway. | Address alone must never activate minting. Must not invent a deployment or use BMC as the NFT. |
| `website/mint-client.js` | Centralizes strict live gating, ABI encoding, chain/account validation, bytecode hash and contract parameter checks. Reads actual stats at a pinned block; checks balance/allowance; approves exact price only if necessary; waits for canonical confirmations; revalidates before mint; displays the NFT from its actual mint log/metadata. | Fixes pre-launch/wrong-chain writes and implements the required approval/burn sequence. |
| `website/mint-client.js` | Handles account/chain/disconnect races, rejection, simulation/revert failures, double clicks, pending persistence/recheck and reorgs without automatic resubmission. Adds gas-estimate headroom for varying Mystery storage paths. | Safe handling of pending/failed transactions; gas variation reproduced during the 500-mint Anvil test. |
| `website/app.js` | Renders the new page, supports injected/EIP-6963 wallets, shows exact wallet status and errors, IPFS gallery failures, transaction links, NFT metadata and a required Mystery risk acknowledgement. Uses DOM text operations for metadata; no automatic wallet prompts. | Required UX and safety behavior; removes VRF claims and broken relative artwork paths. |
| `website/pass-abi.js`, `website/bmc-abi.js`, `script/export_website_abi.py` | Commits ABIs/selectors from the actual configured local build, with an offline freshness check. LIVE mode requires a confirmed ABI hash. | No guessed ABI or deterministic-branch ABI; no network/CDN ABI dependency. Local candidate ABI is not falsely labeled deployed/verified. |
| `script/verify_genesis.py`, `docs/genesis-verification.json` | Fetches every exact filename; validates HTTP status/type, PNG signature, chunk CRCs, dimensions and compressed data. Records all 77 hashes/results; fails visibly for missing images. | Required verification of every Genesis image and no silent substitution. |
| `test/website/*`, `test/tools/*` | Adds offline wallet/page/artwork tests and a full 500-mint integration using compiled bytecode on isolated Anvil. Tests hash preservation of the existing app and the navigation addition. | Every adaptation has meaningful regression coverage without new dependencies. |
| `docs/website-preservation.json` | Records source URL, original index hash and exact hashes/sizes of preserved public assets. | Makes preservation independently reviewable. |
| `README.md`, `docs/LAUNCH.md`, `docs/SECURITY-REVIEW.md`, `docs/TEST-RESULTS.md`, this file | Replaces obsolete VRF/CID setup instructions and unsupported assurances with current behavior, launch handoff, audit disposition, verification evidence and limitations. | Required adaptation notes and honest launch/randomness status. |

Unchanged economics and holder behavior: 500 maximum, 40 sequential Genesis, 37 additional
Genesis, 423 Standard, prices of 1,000,000/350,000 BMC, exact `burnFrom` verification, no recipient
wallet, no owner mint, existing on-chain Standard SVG/traits, ERC-721 ownership/transfers/approvals.
`src/StandardArt.sol`, `src/interfaces/IBMCToken.sol` and the existing artwork files are unchanged.

## Imported audit reproduction and disposition

All five defect findings reproduced. None was dismissed as non-reproducible. The sixth finding
is a coverage statement, with one inaccurate historical assertion about the default fork test
corrected below. Scratch reproductions are disposable; delivered regression coverage is listed.

### 25dd4906267f8bfb978324ec5a6fb9ddda37142549c5ec37fd10cfadac639a65 — missing VRF request

Before edits, a scratch test minted token 41 without fulfillment, then minted 42–51 and delivered
all ten later words. After advancing 2,000,000 blocks and one year, updating VRF parameters and
calling `finalizeReveals(100)`, the result remained zero, with eleven pending tokens and 3.85M
Mystery BMC burned. The reproduction passed against the imported implementation.

Resolved by the brief-required block-random draw: no coordinator request exists to block another
buyer. In the revised commit-reveal flow settlement is again in mint order, but the head token can
always be settled by anyone (from its reveal-block hash inside the window, as Standard after it),
so no token can be stranded. `test_AuditElevenMysteryMintsRevealWithoutAnyExternalService` leaves
the head unrevealed by its owner and has a third party settle all eleven; both full mint-out
simulations and the Anvil integration verify the flow. This removes a liveness dependency while
accepting the weaker randomness explicitly requested; it is not a VRF repair.

### cf3514aa88e1cf3ac7e62ad06b07fcc7d7741f8f7877253f9d49bd19b733b443 — CID setup blocker

The original `test_DeployScriptConfig` confirms both mints revert with `GenesisCIDNotSet` on a
fresh deployment. Original `test_CIDSetOnce` confirms the required owner transaction. Source
inspection confirms a caller-supplied CID was interpolated unescaped into JSON. All 77 files in
the requester's known CID were fetched and validated before pinning it.

Resolved with the constant CID and deletion of the setter/lock/gates. Regression
`test_AuditCIDIsFixedAndNoPostDeploymentConfigurationExists` proves no setter remains and that
renouncing ownership before any mint does not block either phase. Genesis and Standard metadata
checks plus the full mint-out integration cover actual tokenURI decoding and filename ranges.

### f0a6809e385f9d27c54e54d3f7923c2bf9de678b4d32fe473110616258314797 — VRF design/config mismatch

Original `test_MysteryRevertsWhenVRFUnconfigured`, `test_NotAConsumerReverts` and
`test_UnfundedSubscriptionKeepsTokenPendingUntilFunded` all passed, reproducing dependence on
post-deployment owner/coordinator actions. The imported README/site and contract specified VRF,
contrary to this brief's chosen design. Live Chainlink node expiry/deprecation was not exercised.

Resolved by implementing the brief's block-derived design, deleting VRF settings and callbacks,
and preserving unique inventory assignments. There is no coordinator constructor argument or
subscription. Replaced VRF-specific tests accordingly. Public disclosure explains validator,
builder and buyer manipulation; final authorization still requires the requester to confirm the
finalized source/deployment for this chosen design.

### 7956c43628e696d3d3b982bb577c78f2accf250f2cae173453cb1aa26d0a45cd — unsafe website sends

A Node VM reproduction invoked the original connected page handlers with the shipped empty NFT
address and recorded two `eth_sendTransaction` calls: `approve` encoded a zero spender, and the
mint had an empty `to`. A second run on chain 56 with a test-configured address also sent both
transactions. No real wallet or network transaction was involved.

Resolved with disabled HTML buttons and independent code-level PRE_LAUNCH, valid-address and
Mainnet guards. Node tests explicitly attempt forced handler calls, partial live configs,
wrong chains, rejected/reverted/pending approvals, phase/account changes, wrong bytecode and
reorgs. None can silently fall through into an unauthorized mint. The full Anvil test exercises
the successful exact-approval and burn path against the compiled contract.

### fb6f243cf883bb51f218e2a41d7a517554018a5ccbfca040d36a744e0d2030a0 — broken artwork URLs

The original hero and gallery referenced `../artwork/genesis/genesis-NN.png`, while
`IPFS_GATEWAY` was unused. Resolving that relative path under `/mint/` requests `/artwork/...`,
which is not included in the hosted website root. The failure is also apparent when serving only
`website/`, as originally instructed. No relative artwork directory is used by the new page.

Resolved by the supplied gateway + CID + exact filename for hero/gallery and NFT IPFS metadata.
Node tests check every one of 77 preview URLs and visibly reported image failure without a
replacement URL. The HTTP verification report records successful GETs for all 77 files, valid
PNG content, dimensions and distinct SHA-256 hashes.

### bc19e8cc0259493759ee92acc7378078c0e2017b3fa912130e37e63639f04aac — coverage information

Not a defect. The imported baseline passed 43 non-fork tests. Contrary to the prior coverage
statement, its mainnet test did **not** skip on the empty chain: plain execution failed with
`Ethereum mainnet fork required`. The adapted fork tests skip explicitly unless chain 1 and
BMC code exist. Both pass on the supplied machine RPC at block 26,179,236, using local test
balance adjustments and no broadcast, validating real BMC `burnFrom` for Genesis and Mystery.

Original sound properties (exact burn, reentrancy guard, uniqueness, metadata permanence,
constructor without external calls, runtime limits and absence of forbidden opcodes) were kept
and retested. Removed coordinator-specific properties are no longer claimed. No external
security analyzer or real browser extension transaction was run; see the review limitations.

## Verification

See `docs/TEST-RESULTS.md` for commands and recorded outcomes. The runtime is 21,458 bytes under
the existing build settings, with two static constructor arguments. The application requires
no network or installation to build and pass the offline tests. No scratch file is part of the
deliverable or required to reproduce its regression tests.
