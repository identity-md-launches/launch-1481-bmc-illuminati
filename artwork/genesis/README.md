# Genesis artwork delivery

The 77 immutable original PNGs are defined by the unchanged NFT contract at
`ipfs://bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u/genesis-01.png`
through `genesis-77.png`.

The previous tree redundantly tracked roughly 57 MiB of these reference downloads.
To fit this assignment’s 8 MiB Git bundle cap, their local presentation copies now live
in `website/artwork/genesis/` as 77 WebP previews (maximum 360 pixels, quality 72).
Every preview is derived from its corresponding original, never substituted artwork.
`docs/artwork-previews.json` records both original and preview SHA-256 hashes;
`docs/genesis-verification.json` retains the original IPFS availability report.
The contract, CID, filenames and metadata have not changed. Both galleries link to
full-size originals, and every local preview is included in `dist/artwork/genesis/`.

The production build copies committed previews and requires no network or image tools.
