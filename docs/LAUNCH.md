# Website launch handoff — public transactions remain unauthorized

The production configuration is `MODE: "PRE_LAUNCH"`, `DEPLOYMENT_CONFLICT: true` and null staking
address. All public writes are disabled independently of button styling. This website can be
published for read-only use without opening minting or staking.

## Resolve the existing deployment, do not redeploy it

The task supplied NFT `0x92789D9bb680a2Db8617270a530E9D0f80b48641`, while its pinned deployment
record names `0xedd2be808e73bc443bc12aa07586193c193e8d51`. At block 26186477 the latter exactly
matched source revision `ab734601833e7ef15a83647dcf4c33f3013820ba`; the requested address did not.
Both reported the same BMC token and owner, closed minting, and zero minted tokens. The UI labels
read-only data as belonging to the pinned deployment. [CHAIN-VERIFICATION.json](CHAIN-VERIFICATION.json)
records hashes and block evidence. This discrepancy requires the project's authoritative resolution.

Before any future activation, reconcile the address with the finalized reviewed source and immutable
compiler output, independently review contract and frontend findings, establish NFT explorer source
verification, validate the selected deployed mint/burn behavior, and obtain explicit public-mint
authorization. A local fork rehearsal is evidence for review, not authorization. Never substitute
an observed runtime hash for a comparison against reviewed compiler output with actual immutables.
The source of the requested address was not established in this assignment.

The owner must separately authorize and send the irreversible `openMinting()` transaction after
security review. No website handler calls it. Once opened, the contract cannot close or pause minting;
the frontend gate is not on-chain access control. This assignment deploys nothing and grants no
owner authorization. Do not rerun a deployment script to resolve an address disagreement.

## Configuration evidence for a future approved release

| Field in `website/config.js` | Release requirement |
| --- | --- |
| `PASS_ADDRESS` / `REQUESTED_PASS_ADDRESS` / `DEPLOYMENT_CONFLICT` | Authoritative reconciliation; consistent displayed addresses and all read/write pins. |
| `MODE` | Remains `PRE_LAUNCH` until the complete release is approved. |
| `READ_RUNTIME_SHA256` / `BMC_RUNTIME_SHA256` | Reviewed deployed bytecode, raw-byte SHA-256, independently reproduced. |
| `LAUNCH.DESIGN` | `block-random-v1` only when that exact source is selected and reviewed. |
| `SOURCE_REPOSITORY`, `SOURCE_COMMIT` | Exact source repository and immutable revision for the selected deployment. |
| `CONFIRMED_ABI_SHA256` | Canonical sorted ABI JSON SHA-256 matching generated files and the deployment. |
| `REVIEWED_RUNTIME_SHA256` | Exact runtime match after substituting constructor immutables, not only an address hash. |
| `EXPLORER_VERIFIED` | Verified source established; currently false because Etherscan access returned 403. |
| `SECURITY_FINDINGS_ADDRESSED` | Independent review and disposition of all applicable findings; currently false. |
| `DEPLOYED_MINT_AND_BURN_VALIDATED` | Reviewer acceptance of tests for the selected actual deployment; currently false. |
| `PUBLIC_MINT_AUTHORIZATION` | Durable reference to the requester's explicit release authorization; currently empty. |

Regenerate ABIs only if the approved source differs, then review compatibility and rerun the build,
wallet simulations, full-mint integration, fork tests, browser tests and static analysis. Never change
protected build/dependency files or production contracts as part of this website assignment.

## Transaction behavior

Every approval, mint and reveal displays Ethereum, sender, recipient, exact BMC action/value and a
conservative gas-cost estimate before asking the wallet. The wallet controls the actual fee. An
approval grants only one mint price; existing sufficient allowance is reused. A separate review is
required before minting; canceling it leaves any previously confirmed approval in place. No signature
API or unlimited approval is used. Metadata is validated and rendered as text or an image.

Mystery mints burn first and create a pending pass. A visitor must separately request and confirm
`reveal(maxCount)`, which settles pending passes in mint order and burns no BMC. This client limits
one reveal to 50 entries. Anyone can reveal; no automatic keeper is installed. The block-hash draw
is manipulable by block producers and must not be described as guaranteed or cryptographically fair.
The 8,191-block history window is approximately 27 hours at 12 seconds per block; late settlement
falls back to Standard according to the contract, subject to its inventory rules.

The client persists a submission lock before opening the wallet, then stores the returned hash.
Known receipts require two canonical confirmations. A rejection releases the pending request; a
lost response remains locked. Rechecking never automatically continues an approval into a mint.
Unknown, replaced or dropped transactions require wallet activity/Etherscan reconciliation; the
client cannot infer replacement hashes. Clearing storage without resolving the outcome can defeat
that local protection. Interface disconnect does not revoke wallet permissions or allowances.

## Staking and community

`STAKING.address` is null and controls are disabled. The discovered repository states source-only,
undeployed work. A future integration needs an authenticated Mainnet address and matching source/ABI,
real BMC token binding, funded reward accounting, administrative and withdrawal/lock analysis, and
independent review. No configuration toggle alone supplies that missing integration. No yield,
reward balance or unlock date is invented. X/Telegram also require project-owner authentication
before links are added; GitHub and Etherscan are already linked.

## Static publication

Rebuild and submit the entire `dist/` with source and lockfile. The existing IMD publishing process
pins the committed export; no signing account, private configuration or direct publishing command
is needed by this worker. Serve over HTTPS. Both entry pages ship a restrictive script CSP and use
relative assets, including under a gateway subpath. CSP `frame-ancestors` requires an HTTP header
and cannot be enforced by the HTML meta policy; the hosting operator can supply it. The meta policy
omits `upgrade-insecure-requests` so WebKit localhost preview works; production relative assets
inherit HTTPS and every configured external URL is HTTPS.

Keep the original Genesis CID pinned. Local previews remain available offline, but full-size IPFS
availability is an external dependency. No analytics, private key, seed phrase, service credential
or wallet-signing backend belongs in this static export.
