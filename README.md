# BMC Illuminati Pass

A 500-piece Ethereum ERC-721 collection minted by permanently burning the existing BMC token,
`0x38224239f2BDae357D47cb864BC533d7f72dF961`, through `burnFrom`.

**Pre-launch only. No NFT address is configured, no deployment has been made, and public minting
has not been authorized.** Wallet connection, BMC balance reads and artwork previews work in
pre-launch mode. The shipped website cannot request an approval or mint transaction.

## Existing website and new mint page

`website/index.html` preserves the published BMC Illuminati homepage from
<https://bmc-illuminati-know-create-burn.sites.imd.fun/>. Its original compiled application,
stylesheet, icons and social image are included unchanged as ordinary files. The live site's
editable React source was not in this checkout. `docs/website-preservation.json` records the
source and SHA-256 hashes. No package installation or rebuild of that application is needed.

A small separate `mint-nav.js` adds **MINT BMC PASS** to the existing header, including mobile.
The existing home, PASS information, swap, staking, burn, dashboard and community routes and
functionality remain in the original application. `website/mint/index.html` is the new `/mint/`
page; ordinary static servers redirect `/mint` to `/mint/`.

Serve `website/` as the document root, without a build step:

```sh
python3 -m http.server 8080 --directory website
```

Open `/` for the preserved site or `/mint/` for the new mint page. Publish the whole `website/`
directory together when authorized; do not replace it with only the mint HTML. No hosted site
was changed by this assignment.

The new page supports MetaMask and EIP-1193 wallets, with EIP-6963 discovery for multiple injected
wallets. It never requests a seed phrase, private key, login signature, or automatic transaction.
It provides account/chain changes, wrong-network warnings, exact-price approvals, transaction
progress, Etherscan links, pending-transaction recovery, minted NFT display and NFT lookup.

## Collection behavior

- **Genesis, token IDs 1–40:** sequential artwork IDs 1–40; #1 Legendary Genesis, #2–40 Early
  Genesis. Each mint burns exactly 1,000,000 BMC.
- **Mystery, token IDs 41–500:** opens only after all 40 Genesis are sold. Each mint burns exactly
  350,000 BMC and issues an unrevealed pass. `reveal(maxCount)`, callable by anyone, settles
  pending passes in mint order from the hash of the block after each mint block, drawing without
  replacement from 37 Genesis artworks (#41–77) and 423 Standard artworks. The hash is readable for
  8,191 blocks (about 27 hours, via EIP-2935); a pass nobody reveals in that window settles as
  Standard, so delaying a reveal never helps. The mint page sends the reveal for the buyer.
- **Randomness risk:** the draw uses a future block hash, the collection address and the token ID.
  It is **not cryptographically manipulation-resistant**: the proposer of the reveal block can bias
  it, and builders/validators influence inclusion/ordering. Buyers cannot preview, pick or revert an
  outcome because the burn is final before the hash exists. Uniqueness does not guarantee fair
  allocation. This is the requested block-random design, not Chainlink VRF or the deterministic branch.
- **Launch gate:** on Ethereum Mainnet (chain id 1) minting is closed from deployment until the
  owner calls `openMinting()` once; nothing can close it again. Other chain ids are open from
  construction for rehearsals.
- **Artwork:** Genesis uses the requester's immutable CID
  `bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u`, with filenames
  `genesis-01.png` through `genesis-77.png`. All 77 PNGs were fetched and validated; the full report
  is `docs/genesis-verification.json`. Nothing substitutes local artwork for missing IPFS files.
  Standard artwork and JSON metadata are rendered on-chain using the existing `StandardArt` library.
- **Burn:** both payer balance and BMC total supply must decrease by the exact price, or the entire
  mint reverts. No BMC is transferred to a developer or retained by the NFT contract. Maximum burn
  is 201,000,000 BMC. The contract rechecks BMC's 18 decimals on every mint.

Beyond the one-way opening, the owner has no privileged mint, metadata, randomness, pricing,
withdrawal, pause or upgrade power. Standard inherited ownership transfer/renunciation remains.
ERC-721 transfers, approvals and metadata views retain their existing behavior.

## Factory handoff

Only `BMCIlluminatiPass` is an application contract to deploy. Constructor:
`(address initialOwner, address bmcToken)`, nonpayable, two static arguments.

- `initialOwner`: `$owner`, resolving to the supplied owner
  `0x83027AD9d0D5374335086c539dADD1db983441B0`.
- `bmcToken`: the existing mainnet BMC address above.

The constructor makes no external calls and does not require token code on the empty rehearsal
chain. The token is checked on first mint. All parameters are configured at construction; no
setter/initializer calls follow deployment. `StandardArt` has only internal functions and needs
no linked-library deployment. No launch token, pool, proxy or manifest was added.

`script/Deploy.s.sol` is now a simulation helper; it does not start a broadcast. The launch
factory handles any separately authorized deployment. On mainnet the deployed contract stays
closed until the owner's `openMinting()`; after that the mint functions are permissionless and the
website's launch controls govern only its interface. Do not deploy merely to preview this website.

## Launch authorization

Follow `docs/LAUNCH.md` before changing `website/config.js`. An address alone cannot enable
minting. Obtain the finalized source repository/revision for the chosen block-random design and
the actual mainnet deployment address from the requester/deployer. Confirm its ABI, review and
runtime bytecode, explorer verification, deployed mint/burn validation and explicit public-mint
authorization. The deterministic development branch is a different design and is not used here.

`pass-abi.js` and `bmc-abi.js` are generated from the local Foundry build. They are candidate build
artifacts, **not claims of a verified mainnet deployment**. The live gate requires the confirmed
ABI hash, and each mint checks the actual deployed runtime against the reviewed runtime hash.

## Checks

No new build dependencies were introduced. Use the existing Foundry configuration:

```sh
forge build
forge test
python3 script/export_website_abi.py --check
node --test test/website/*.test.cjs
python3 -m unittest discover -s test/tools -p 'test_*.py'
```

The JavaScript tests use Node built-ins; their contract integration test starts isolated Anvil
on a free loopback port, without network access, keys or broadcasts. Run `forge build` first so
its artifacts exist. The two mainnet-fork tests explicitly skip on an empty offline chain and
are also checked separately against the real BMC token:

```sh
forge test --match-contract BMCMainnetForkTest \
  --fork-url <ethereum mainnet archive RPC> --fork-block-number 26179236 -vv
```

The above RPC is specific to this contributor machine; it is not part of the public website.
For a fresh artwork availability report, run `python3 script/verify_genesis.py` while online.
The build and offline tests use the checked-in report and never fetch artwork or dependencies.

See `ADAPTATION.md` for every adaptation and audit disposition, `docs/SECURITY-REVIEW.md` for
remaining risks and `docs/TEST-RESULTS.md` for verification results and limits.
