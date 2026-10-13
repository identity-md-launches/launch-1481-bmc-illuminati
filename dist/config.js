// PRE_LAUNCH remains mandatory until address reconciliation and independent release approval.
// The source-pinned deployment below is used ONLY for read-only collection data in this release.
window.BMC_PASS_CONFIG = Object.freeze({
  MODE: "PRE_LAUNCH",
  CHAIN_ID: 1,
  CHAIN_NAME: "Ethereum Mainnet",
  EXPLORER: "https://etherscan.io",
  RPC_URLS: Object.freeze(["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"]),
  BMC_ADDRESS: "0x38224239f2BDae357D47cb864BC533d7f72dF961",
  PASS_ADDRESS: "0xedd2be808e73bc443bc12aa07586193c193e8d51",
  REQUESTED_PASS_ADDRESS: "0x92789D9bb680a2Db8617270a530E9D0f80b48641",
  DEPLOYMENT_CONFLICT: true,
  BMC_RUNTIME_SHA256: "b0ae261c881b8c6da58e46652b6b0ced43844d4cabb3174c6e710f3de2e45976",
  READ_RUNTIME_SHA256: "64503241c35f6ad4f325d43a73bd7af53f1063222dc15a7244b5b952f56c3673",
  GITHUB: "https://github.com/identity-md-launches/launch-1481-bmc-illuminati",
  STAKING: Object.freeze({ address: null, enabled: false, source: "https://github.com/identity-md-launches/launch-1357-project-bmc-illuminati" }),
  COMMUNITY: Object.freeze({ x: null, telegram: null }),
  IPFS_GATEWAY: "https://silver-active-lungfish-941.mypinata.cloud/ipfs/",
  GENESIS_CID: "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u",
  GENESIS_PRICE: 1000000n * 10n ** 18n,
  MYSTERY_PRICE: 350000n * 10n ** 18n,
  LAUNCH: Object.freeze({
    DESIGN: "block-random-v1",
    SOURCE_REPOSITORY: "https://github.com/identity-md-launches/launch-1481-bmc-illuminati",
    SOURCE_COMMIT: "ab734601833e7ef15a83647dcf4c33f3013820ba",
    CONFIRMED_ABI_SHA256: "f8ef521233c556d40a71a82c7c4fe843523cc6f6303a9093efcd139b929c7a4f",
    REVIEWED_RUNTIME_SHA256: "64503241c35f6ad4f325d43a73bd7af53f1063222dc15a7244b5b952f56c3673",
    EXPLORER_VERIFIED: false, // Etherscan returned HTTP 403; do not infer verification.
    SECURITY_FINDINGS_ADDRESSED: false, // Requires independent review.
    DEPLOYED_MINT_AND_BURN_VALIDATED: false, // Local fork rehearsal is not release authorization.
    PUBLIC_MINT_AUTHORIZATION: "",
  }),
});
