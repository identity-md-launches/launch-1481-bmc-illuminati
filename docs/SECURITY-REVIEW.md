> Historical contract-adaptation record, retained from the prior revision. For the 2026-10-13 website release, read [VALIDATION.md](VALIDATION.md) and [WEBSITE-SECURITY.md](WEBSITE-SECURITY.md). The NFT address is now configured for labeled read-only data; public writes remain locked because the two deployment records disagree. Reveal now requires a separate user action. No contract change or deployment was made by this website task.

# Security review of the adaptation

This is the implementing contributor's review, **not independent launch authorization**. The
public website stays in pre-launch mode. Independent final review and the evidence in `LAUNCH.md`
are required before activation.

## Scope and retained behavior

Reviewed the application contract, internal StandardArt library, BMC interface, inherited
OpenZeppelin ERC721/Ownable/ReentrancyGuard behavior, deployment helper, mint client/UI and tests.
The reviewed application uses no proxy, external linked library, delegatecall, callcode,
selfdestruct, pausing, freezing, seizure or special owner mint. The two constructor arguments are
static addresses; ownership is assigned to the explicit owner, never the factory or tx.origin.
All CID, price and inventory parameters are fixed at creation. Constructor external calls are
absent. BMC code/decimals are checked on first mint and every later mint.

The original exact-burn guard remains: balance and total supply must decrease by the price.
`nonReentrant` covers token interactions and ERC-721 receiver callbacks. A rejected receiver,
wrong token behavior or insufficient allowance rolls back the burn and the complete mint.
The original StandardArt renderer, 500-token cap, prices, unique artwork inventory and ERC-721
transfer behavior are retained.

## Imported findings

All five concrete imported findings reproduced before adaptation. See `ADAPTATION.md` for the
reproduction evidence, full finding IDs, resolutions and replacement tests. The sixth entry was
coverage information, not a defect. Historical Chainlink callback/configuration checks no longer
apply because the task explicitly requests block-derived randomness. This change is not a claim
that block randomness is stronger than VRF.

## Accepted design risk: manipulable block randomness (revised: commit-reveal)

Mystery mints burn and issue a pending pass recording the mint block. `reveal` settles pending
passes in mint order from `blockhash(mintBlock + 1)` mixed with the collection address and token
id, through the existing virtual Fisher-Yates pool. Full sellout still guarantees 37 Mystery
Genesis and 423 Standard outcomes without duplicate artwork.

What the revision closes (independent finding `cfb1eeea…`): the outcome does not exist while the
burn is reversible, so a contract caller cannot observe and revert, an EOA cannot simulate against
the next block and send only on a good result, and fresh helper contracts do not yield fresh draws
(`msg.sender` is not an input). A reverted reveal changes nothing; a delayed reveal cannot improve
anything because the reveal hash is fixed and, past the window, the pass settles as Standard.
In-order settlement stops a holder from timing a reveal against other buyers' reveals.

**What remains, and is disclosed:** the proposer of the reveal block chooses among candidate
blocks (and can withhold one at the cost of the block reward), so allocation can still be biased by
whoever builds that block. Inclusion and ordering remain under builder influence. EIP-2935 lookups
depend on the history contract being present on mainnet (it is, since Prague); if it were absent,
the native 256-block window applies and later reveals settle as Standard, which the metadata
and events (`forced`) make visible. The design is not provably fair and must not be marketed as
tamper-proof. Inventory ratios describe inventory, not manipulation-resistant odds.

## Launch gate (independent finding `b5ce1446…`)

On chain id 1 (mainnet and forks of it) minting is closed from construction until the owner's
one-way `openMinting()`; there is no closing, pausing or restricting call, and the open state
survives ownership renunciation. On other chain ids the contract is open from construction so that
rehearsal chains and the reviewer's held proof work unchanged. This is the only owner power.

Gas estimates for `reveal` can differ between simulation and inclusion (another reveal may settle
part of the queue first, or a forced-Standard scan may run). The client includes 20% plus 50,000
gas headroom over the wallet RPC estimate and bounds a reveal to 50 passes. No gas buffer creates
fairness or prevents a reverted transaction; a reverted reveal simply leaves the pass pending.

## Website boundaries

Pre-launch is enforced in both initial HTML `disabled` attributes and code guards. The unset NFT
address cannot be encoded into an approval. The BMC address, zero address and dead-address sentinel
cannot pass as the NFT address. The default configuration has no public-mint authorization or
verified runtime hash. The ABI is generated from the local candidate build; a separate verified
launch record is required before using it against a mainnet deployment.

Each mint checks chain 1, active account, matching deployed runtime hash and collection parameters,
phase, supply, balance and allowance. It requests only the exact single-mint approval when needed,
waits for its canonical receipt and two block confirmations, then revalidates before asking for
the mint. Failed/rejected/pending operations cannot fall through to minting. Account/chain changes
invalidate the session. Double clicks and unresolved hashes are locked; persistence and recovery
are covered by tests. The selected provider supplies RPC data, so an untrustworthy wallet/RPC or
compromised hosting can still lie. Release configuration is a trusted maintainer artifact, not a
cryptographic signature of launch approval.

Minted token IDs come from the transaction's NFT `Transfer` log, not from guessing the last token
ID. Metadata is parsed as data, text is inserted with DOM text APIs, and artwork is restricted to
the pinned Genesis directory or an SVG data URI rendered as an image. Missing images remain
reported as missing. No unsafe HTML from NFT metadata is executed.

A dropped/replaced hash is deliberately not treated as a failed transaction; automatic resubmission
could double charge. Users must resolve it in their wallet/Etherscan. Storage can be unavailable;
the current tab still locks pending work, but a closed page may lose that record. Two confirmations
reduce ordinary reorg exposure; they are not economic finality. Client controls cannot prevent
someone from calling the deployed contract directly.

## Verification and limits

`forge build`, `forge test`, factory constructor/runtime/opcode rehearsal, fuzz tests, two
mainnet-fork BMC burn tests, Node wallet/UI regression tests and an offline full 500-mint Anvil
integration test were run. All 77 IPFS PNG files were GET-fetched, PNG chunks/CRC/zlib data and
file names validated, and SHA-256/dimensions recorded. Original published website assets are
checked by hash. No build configuration or vendored dependencies were changed.

No Slither/Mythril campaign, real browser extension transaction, pixel-based mobile/desktop
browser test, mainnet NFT deployment, deployed NFT explorer verification or public-mint approval
was performed. The DOM tests cover client controls and error handling; responsive CSS is present,
but those tests are not a visual browser audit. Live Chainlink node behavior was never exercised
and is no longer a dependency. The deterministic branch was not adopted. A later contract revision
requires a fresh review, ABI generation, runtime comparison and test run.
