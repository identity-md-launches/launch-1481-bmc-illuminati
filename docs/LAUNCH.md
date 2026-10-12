# BMC PASS launch handoff — not authorized to go live

The delivered configuration is `MODE: "PRE_LAUNCH"`, `PASS_ADDRESS: ""`, with all deployment and
approval fields unset. This is intentional. Wallet connection requests account access only;
buttons are disabled in HTML and every write path independently checks the live gate.

## Required evidence from the requester/deployer

Before activating public minting, obtain the **finalized source repository and immutable revision
for the chosen block-random Mystery design**, plus its **actual Ethereum Mainnet deployment
address**. Confirm explicitly whether the adapted source in this submission is the final chosen
revision. The provided `feature/deterministic-pass` branch is a different design; neither its ABI
nor its deployment belongs in this interface. The existing BMC ERC-20 is never the NFT address.

The responsible reviewer/deployer must complete all of these before enabling the interface:

1. Independently review the finalized source, constructor arguments and compiled artifact. Resolve
   security findings; explicitly acknowledge the block-randomness manipulation/receiver rollback
   risk. Tests and the contributor's notes do not replace independent review.
2. Separately authorize and perform deployment through the factory on chain 1 with zero ETH,
   `initialOwner = $owner` (the specified owner) and the existing BMC token address. No worker
   deployment, token permission change or VRF subscription is required or authorized here.
3. Verify the final source on Etherscan and confirm the deployed address belongs to
   `BMCIlluminatiPass`, has no proxy, uses the intended owner and BMC, and exposes the intended ABI.
4. Compare every deployed runtime byte against the reviewed compiler output with the **actual
   constructor immutables substituted**. Use the project's unmodified compiler configuration.
   Do not derive trust merely by hashing whatever code happens to be at the supplied address.
   After that comparison, record SHA-256 of the raw deployed runtime bytes (not the hex text).
5. Validate minting/burning against that deployed contract, including exact allowance, exact BMC
   supply/balance decreases, phase boundary, minted NFT metadata and sold-out behavior. A fork of
   the actual deployment permits rehearsals without automatically spending mainnet funds. Record
   deployment address, chain, block and test evidence. The development tests here do not validate
   any future deployment address.
6. Obtain the requester's explicit **public-mint authorization** and record its durable reference.

The factory-compatible contract is fully configured at creation and has no on-chain enable/pause
switch. Direct mint calls become possible as soon as it is deployed. Coordinate deployment,
verification and launch authorization accordingly; the website gate is not on-chain access control.

## Configuration after all prerequisites

In `website/config.js`, set `PASS_ADDRESS` to the confirmed NFT address and `MODE` to `LIVE` only
as part of the approved release. Fill every `LAUNCH` field:

| Field | Required evidence |
| --- | --- |
| `DESIGN` | `block-random-v1`, matching the reviewed implementation. |
| `SOURCE_REPOSITORY` | The finalized source repository URL obtained from the requester. |
| `SOURCE_COMMIT` | Its exact 40-hex revision; do not invent one. |
| `CONFIRMED_ABI_SHA256` | Hash of the confirmed ABI, matching the generated build file. |
| `REVIEWED_RUNTIME_SHA256` | SHA-256 of the reviewed runtime after the byte-for-byte comparison above. |
| `EXPLORER_VERIFIED` | True only after successful source verification. |
| `SECURITY_FINDINGS_ADDRESSED` | True only after review is complete and its findings are addressed. |
| `DEPLOYED_MINT_AND_BURN_VALIDATED` | True only after the actual deployment is validated. |
| `PUBLIC_MINT_AUTHORIZATION` | Reference to the requester's explicit authorization. |

If finalized source differs, regenerate the ABI with `forge build` and
`python3 script/export_website_abi.py`, review the interface compatibility and rerun the tests.
ABI hashes use Python JSON serialization with sorted keys, no spaces (`separators=(",", ":")`)
and SHA-256 of the resulting UTF-8 text. Generated files record this hash. Keep the ABI in the
release; there is no CDN or runtime ABI download.

`mint-client.js` verifies runtime code, BMC address, decimals, collection name/symbol, ERC-721
support, CID, supply cap and fixed prices before allowing a mint. It reads actual supply and burn
stats at one block, rechecks the account/chain before each send, simulates the transaction and
requests exact approval only when allowance is insufficient. It awaits two canonical block
confirmations before continuing after approval. It rechecks phase, balance, allowance and code
again before minting, then obtains the minted ID from the NFT contract's `Transfer` event.

## Hosting and operations

- Publish the whole `website/` tree over HTTPS, keeping `/` and its original hash routes intact.
  `/mint` must resolve to `mint/index.html` (a directory redirect to `/mint/` is fine). Host all the
  checked-in assets; do not load the original app's assets from an unrelated live origin.
- The new page uses the selected injected wallet for Ethereum reads. No RPC secret, seed phrase,
  private key or service key belongs in site configuration. `crypto.subtle` needs HTTPS or localhost.
- The original published home application still shows its pre-launch informational copy. It is
  deliberately preserved. If public minting is later authorized, coordinate an authorized update
  of those original status labels using its editable source; changing mint config does not rewrite
  that original application.
- Keep the Genesis directory pinned. `script/verify_genesis.py` fetches all expected files and
  fails if any is absent or invalid. The browser shows failed artwork explicitly and never swaps
  in a different image. A successful check on one date is not a future availability guarantee.
- A pending transaction remains locked against duplicate submission; its hash is retained in
  browser storage when available. Rechecking never automatically sends a mint after an approval.
  If a wallet replaces or cancels a transaction, use its activity view/Etherscan to identify the
  replacement: this version deliberately cannot infer a replacement hash and never auto-resubmits.
  Do not clear a pending record while its outcome is unknown. If local storage is unavailable or
  the page closes before a hash returns, consult wallet activity before attempting another mint.
- A wallet-side rejection stops the flow. A reverted mint rolls back its burn, but gas can be spent
  and an earlier successful approval can remain. The interface does not revoke token allowances
  or disconnect permissions automatically.

No deployment, hosted-site publication, wallet signature, token permission change, Chainlink
subscription or paid job was executed by this assignment.
