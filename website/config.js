// PRE-LAUNCH by default. Address alone never enables transactions.
// Fill the launch record only AFTER the separate review/deployment/authorization in docs/LAUNCH.md.
window.BMC_PASS_CONFIG = Object.freeze({
  MODE: "PRE_LAUNCH",
  CHAIN_ID: 1, // Ethereum mainnet
  CHAIN_NAME: "Ethereum Mainnet",
  EXPLORER: "https://etherscan.io",
  BMC_ADDRESS: "0x38224239f2BDae357D47cb864BC533d7f72dF961",
  PASS_ADDRESS: "", // Intentionally unset: no NFT contract has been deployed or approved.
  IPFS_GATEWAY: "https://silver-active-lungfish-941.mypinata.cloud/ipfs/",
  GENESIS_CID: "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u",
  GENESIS_PRICE: 1000000n * 10n ** 18n,
  MYSTERY_PRICE: 350000n * 10n ** 18n,
  LAUNCH: Object.freeze({
    DESIGN: "block-random-v1",
    SOURCE_REPOSITORY: "", // Request the finalized source repository for this design.
    SOURCE_COMMIT: "",
    CONFIRMED_ABI_SHA256: "",
    REVIEWED_RUNTIME_SHA256: "", // Reviewed deployed runtime including constructor immutables.
    EXPLORER_VERIFIED: false,
    SECURITY_FINDINGS_ADDRESSED: false,
    DEPLOYED_MINT_AND_BURN_VALIDATED: false,
    PUBLIC_MINT_AUTHORIZATION: "", // Reference to the requester's explicit authorization.
  }),
});
