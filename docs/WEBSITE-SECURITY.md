# Current website security review — 2026-10-13

This is the implementing contributor's review, not an independent audit or a guarantee. The shipped
site permits account connection and reads, but no public approval, mint, reveal, stake, withdrawal
or reward claim. `MODE: PRE_LAUNCH` and the deployment conflict remain enforced in the client.
No existing contract, dependency or Foundry configuration was changed.

## Contract identity and authority

The existing site is represented by the supplied `launch-1481-bmc-illuminati` tree. Its inherited
compiled bundle, CSS and identity assets still match `website-preservation.json`. The requested
site URL is retained; the publisher consumes `dist/`, which is rebuilt here from local source.

At Ethereum block **26186477**, hash
`0x0132bc704809b599f9d8806dd905f736119307fc88461c0387ed451c4ab21bcf`, the pinned NFT
`0xedd2be808e73bc443bc12aa07586193c193e8d51` matched the unmodified local compiler runtime after
substituting its BMC immutable, byte for byte. The canonical ABI Keccak matched the pinned
attestation; the frontend's separate canonical ABI SHA-256 matched its generated ABI export.
The requested NFT `0x92789D9bb680a2Db8617270a530E9D0f80b48641` had a different runtime, so it was
not trusted with this ABI for writes. Both were closed with zero minted. Full evidence and raw-byte
hashes are in [CHAIN-VERIFICATION.json](CHAIN-VERIFICATION.json). The distinction is visible in
both collection and mint screens. No claim is made that one request supersedes the other.

Etherscan returned HTTP 403 for the token and both NFT addresses. Thus explorer source verification
was attempted but could not be established. The NFT addresses also had no Sourcify record at the
queried endpoints. The BMC [Sourcify record](https://sourcify.dev/server/v2/contract/1/0x38224239f2BDae357D47cb864BC533d7f72dF961?fields=all)
provided source and recompiled/deployed runtime matching the chain bytes. It is an ERC20 plus
ERC20Burnable with 18 decimals and fixed initial supply. The matched code has no owner, ongoing
mint, upgrade, pause, blocklist or transfer tax. `burnFrom` spends allowance and reduces both payer
balance and total supply; it does not transfer payment to a treasury.

The pinned NFT has fixed cap/prices/artwork, no proxy, upgrade, paid-admin mint or withdrawal.
Its owner can transfer/renounce ownership and open Mainnet minting once; there is no close/pause.
The token binding is immutable. Its `nonReentrant` mint functions surround burn and receiver calls;
exact balance/supply deltas are checked. Contract-level tests and a local deployed fork exercised
these boundaries, but do not prove the source safe against all possible attacks.

## Static analysis findings retained for independent review

The exact command `slither . --exclude-informational --exclude-optimization --exclude-low
--exclude-medium` reported **3 High results**, exit 255. This is not a passing security check:

| Finding | Location | Assessment and release disposition |
| --- | --- | --- |
| `weak-prng` | `src/BMCIlluminatiPass.sol:253` | Real design limitation: the future block hash is not cryptographically manipulation-resistant. The separate burn/reveal prevents buyer rollback selection but not block-builder/proposer bias. Disclosed beside Mystery; independent reviewer must assess release acceptability. |
| `incorrect-exp` | `lib/openzeppelin-contracts/contracts/utils/math/Math.sol:205` | The inherited `^ 2` is the usual intentional XOR seed in modular-inverse computation. This contextual reading does not suppress the detector or constitute independent disposition. Dependency edits are forbidden in this assignment. |
| `reentrancy-balance` | `src/BMCIlluminatiPass.sol:242` | Detector flags the balance/supply checks around external `BMC.burnFrom`. Here the BMC address is immutable, its matched source has no callback, and mint entry points are `nonReentrant`. Reviewer must confirm those assumptions and call graph; not waived by an inline suppression. |

The requested task explicitly prohibits modifying the NFT contract or existing dependencies. The
three results are carried forward, and `SECURITY_FINDINGS_ADDRESSED` stays false. No analysis-only
change to an ignore/configuration file was used to hide them. The unrelated `forge fmt --check`
failure is a pre-existing missing blank line at `script/Deploy.s.sol:12`, whose bytes remain unchanged.

## Wallet and transaction controls

- Initial page load never calls the injected wallet RPC. Provider discovery uses EIP-6963; account
  permission is requested only after Connect. No signing, private-key, recovery-phrase, permissions
  expansion or hidden transaction API is present in the new client.
- The Ethereum network and full connected account are displayed. Account/chain/disconnect changes
  invalidate balances, selected NFT and session readiness. Wrong-chain balances are withheld.
- Runtime checks pin the BMC and NFT bytes. The live gate additionally checks ABI, reviewed source,
  explicit authorization and collection invariants. For public statistics, code and data are read
  at a single block and validated for consistency. A failed read clears live figures.
- A requested action is simulated and gas estimated, then the native dialog shows sender, recipient,
  spender where relevant, exact BMC amount, zero ETH value and estimated fee budget. The estimate
  uses gas headroom and current gas price, not a guaranteed final charge. After confirmation the
  client revalidates session/code/phase/price and simulates again; the wallet separately confirms.
- Approval is the exact current mint price, never an unlimited amount. Mint requires a second review
  after canonical approval. A previous larger allowance is never increased simply to mint. Canceling
  a mint does not undo an approval already confirmed; permission revocation remains wallet-controlled.
- Mystery does not initiate a reveal automatically. The holder must click the separate reveal action,
  review its destination/fee and confirm. Reveal is permissionless and processes the queue in order.
- Busy and persistent pending locks prevent duplicate submissions. A lock is stored before asking
  the wallet to send, covering reloads while the prompt is open. Returned hashes replace that lock;
  explicit rejection clears it. Ambiguous send failures and invalid hashes preserve the lock.
- Receipts must match sender/target/hash, succeed and remain canonical for two confirmations. A failed
  or pending approval cannot trigger minting. Recheck never sends. Replacement/cancellation hashes
  cannot be safely inferred, so the interface directs users to wallet activity/Etherscan.

These protections are local frontend protections. Clearing storage, using another browser or calling
the contract directly bypasses local locks. If storage is unavailable, the in-memory lock cannot
survive closing the page. A malicious/compromised wallet, RPC, host or browser remains outside this
implementation's trust boundary. No public transaction was sent during validation.

## Metadata, dependencies and browser policy

The ABI files are generated from the unchanged Foundry artifacts and pass the existing freshness
checker. Existing locally bundled React runtime code is retained with provenance; new build-only
dependencies are pinned by version/integrity. There is no runtime CDN, analytics, remote ABI fetch,
secret RPC URL, npm cache or dependency archive in the export. The runtime still contains unused
inherited wallet-library code, but its old provider root is not mounted; the shared injected-wallet
client is the active path. The original bundle remains for preservation and deterministic extraction.

Both HTML entry points restrict scripts to self, deny object embedding, constrain form/base URLs,
and allow only the two public read RPC origins and the original image gateway. Inline styles are
allowed for retained React styling; inline scripts/eval are not. Every external link created by the
new UI uses `noopener noreferrer`. Full addresses wrap instead of being truncated in transaction
review. Metadata JSON is bounded/validated; image URLs are limited to the contract CID or base64 SVG,
rendered as an `<img>` without injecting SVG/HTML into the document. Image failure is explicit.

Public RPC providers see routine read requests, and wallet providers see account-linked reads after
connection. Pending transaction records use local storage only for recovery. No account telemetry,
email or unrelated personal data is collected. Original full-size IPFS files remain a third-party
availability dependency; all 77 local gallery previews are bundled for offline use.

## Staking and community limits

The existing site's staking job record pointed to
[launch-1357-project-bmc-illuminati](https://github.com/identity-md-launches/launch-1357-project-bmc-illuminati),
whose README states source-only, not deployed or independently audited. Neither it nor the pinned
deployment/site configuration supplied an authenticated Mainnet staking address. This is not proof
that no third-party contract exists. It is insufficient evidence to accept deposits. Token binding,
admin powers, funding, lockups, emergency paths and real rewards therefore remain **unverified**.
The UI does not create a transaction handler for staking and shows no invented balance/APY/unlock.
Actual stake/unstake/claim execution cannot be tested without a reviewed deployment; only the safe
fallback, forms and disabled actions were exercised. No new staking contract was created.

X and Telegram were null in project sources. A third-party Telegram suggestion was not authenticated
by a project-owned source, so no unofficial account is linked. Visible confirmation labels preserve
the requested navigation placement. Confirmed GitHub, Etherscan, collection and staking links work.

## Release conclusion

The read-only PRE_LAUNCH site is prepared for static delivery. Public financial actions remain
blocked pending authoritative address reconciliation, explorer/source evidence, independent security
review and explicit owner release authorization. A staking integration requires its own verified
contract and terms. Tests, this review and the visual guide supply evidence, not an independent audit.
