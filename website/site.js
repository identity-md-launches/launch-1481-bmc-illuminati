// Application recovered from the supplied published bundle; all existing routes retained.
import {
  ne,
  m,
  Yu,
  o0,
  Gw,
  Yw,
  $w,
  Db,
  Hw,
  gS,
  dw,
  tc,
  DS,
  Q6,
  m6,
  yw,
  y6,
} from "./assets/legacy-runtime.js";
const P = window.BMCPlatform;
const C = window.BMC_PASS_CONFIG;
const h = ne.createElement;
const usePlatform = () =>
  ne.useSyncExternalStore(P.subscribe, P.snapshot, P.snapshot);
const external = (href, label, props = {}) =>
  h(
    "a",
    { href, target: "_blank", rel: "noopener noreferrer", ...props },
    label,
  );
function Icon({ kind = "arrow" }) {
  const shapes = {
    arrow: "M7 17 17 7M7 7h10v10",
    github:
      "M9 19c-4 1-4-2-6-2m12 4v-4c0-1-.2-2-1-2 4-.5 7-2 7-6 0-1-.4-3-1.5-4 .2-1 0-2-.3-3-2 0-3 1-4 2a13 13 0 0 0-6 0C8 3 7 2 5 2c-.4 1-.5 2-.2 3C4 6 3.5 8 3.5 9c0 4 3 5.5 7 6-.5.5-1 1-1 2v4",
    x: "M4 3l16 18M20 3 4 21M4 3h5l11 18h-5L4 3",
    telegram: "m3 11 18-8-5 18-5-7-8-3Zm8 3 10-11",
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
  };
  return h(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      "aria-hidden": true,
    },
    h("path", {
      d: shapes[kind] || shapes.arrow,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}
function CommunityLinks({ expanded = false, compact = false } = {}) {
  return h(
    expanded ? "section" : "div",
    { className: "community-links" + (compact ? " compact" : "") },
    expanded ? h("h2", {}, "Project links") : null,
    h(
      "div",
      { className: "community-row" },
      external(
        C.GITHUB,
        h(ne.Fragment, {}, h(Icon, { kind: "github" }), "GitHub"),
      ),
      external(
        `${C.EXPLORER}/token/${C.BMC_ADDRESS}`,
        h(ne.Fragment, {}, h(Icon), "Etherscan"),
      ),
      h("a", { href: compact ? "#/pass" : "./#/pass" }, h(Icon), "Collection"),
      h(
        "a",
        { href: compact ? "#/staking" : "./#/staking" },
        h(Icon),
        "Staking",
      ),
      h(
        "span",
        {
          className: "unconfirmed",
          title: "No official account is confirmed in the project sources.",
        },
        h(Icon, { kind: "x" }),
        "X · Unconfirmed",
      ),
      h(
        "span",
        {
          className: "unconfirmed",
          title: "No official channel is confirmed in the project sources.",
        },
        h(Icon, { kind: "telegram" }),
        "Telegram · Unconfirmed",
      ),
    ),
    expanded
      ? h(
          "p",
          { className: "muted" },
          "X and Telegram are awaiting owner confirmation. Third-party listings are not treated as official links.",
        )
      : null,
  );
}
function WalletControls({ compact = false, quiet = false } = {}) {
  const s = usePlatform();
  const [provider, setProvider] = ne.useState("0");
  return h(
    "div",
    { className: "wallet-controls" },
    s.wallet.account
      ? h(
          ne.Fragment,
          {},
          h(
            "span",
            { className: "wallet-address", title: s.wallet.account },
            s.wallet.account.slice(0, 6) + "…" + s.wallet.account.slice(-4),
          ),
          !compact
            ? h(
                "span",
                { className: "muted" },
                s.wallet.chainId === "0x1"
                  ? "Ethereum Mainnet"
                  : "Wrong network (" + (s.wallet.chainId || "unknown") + ")",
              )
            : null,
          s.wallet.chainId !== "0x1"
            ? h(
                "button",
                {
                  className: "btn btn-secondary",
                  onClick: P.switchNetwork,
                  disabled: s.wallet.busy,
                },
                "Switch to Ethereum",
              )
            : null,
          h(
            "button",
            { className: "btn btn-ghost", onClick: P.disconnect },
            "Disconnect",
          ),
        )
      : h(
          ne.Fragment,
          {},
          s.providers.length > 1
            ? h(
                "label",
                { className: "wallet-select" },
                "Wallet",
                h(
                  "select",
                  {
                    value: provider,
                    onChange: (e) => setProvider(e.target.value),
                    disabled: s.connecting,
                  },
                  ...s.providers.map((p, i) =>
                    h("option", { key: i, value: i }, p.name),
                  ),
                ),
              )
            : null,
          h(
            "button",
            {
              className: "btn " + (compact ? "btn-secondary" : "btn-primary"),
              onClick: () => P.connect(Number(provider)),
              disabled: s.connecting,
            },
            s.connecting ? "Connecting…" : "Connect wallet",
          ),
        ),
    !compact && !quiet
      ? h(
          "p",
          { className: "wallet-message", role: "status" },
          s.wallet.message || "Connection requests account access only.",
        )
      : null,
  );
}
function ReadStatus() {
  const s = usePlatform();
  return h(
    "div",
    { className: "read-status" },
    h(
      "span",
      { role: "status" },
      s.loading
        ? "Reading Ethereum…"
        : s.publicError ||
            `Ethereum block ${BigInt(s.public.block).toLocaleString("en-US")} · Read ${new Date(s.public.readAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
    ),
    h(
      "button",
      {
        className: "btn btn-ghost",
        onClick: P.refreshPublic,
        disabled: s.loading,
      },
      "Refresh data",
    ),
  );
}
function HomeStatus() {
  const s = usePlatform();
  return h(
    "section",
    { className: "home-status", "aria-label": "Collection and wallet" },
    h(
      "div",
      {},
      h("span", { className: "muted" }, "Collection"),
      h(
        "strong",
        {},
        s.public ? `${s.public.minted} / 500 minted` : "500 Passes · Fixed cap",
      ),
    ),
    h(
      "div",
      {},
      h("span", { className: "muted" }, "Genesis mint price"),
      h("strong", {}, "1,000,000 BMC"),
    ),
    h(
      "div",
      {},
      h("span", { className: "muted" }, "Launch status"),
      h("strong", {}, "Pre-launch · Locked"),
    ),
    h(WalletControls, { compact: false }),
  );
}
function DeploymentNotice() {
  return h(
    "details",
    { className: "deployment-notice" },
    h(
      "summary",
      {},
      h(Icon, { kind: "shield" }),
      "Mint locked: contract confirmation pending",
    ),
    h(
      "p",
      {},
      "The requested NFT address and the IMD deployment record refer to different contracts. Both had minting closed at the verification block. This site displays read-only data from the source-matched IMD deployment.",
    ),
    h(
      "dl",
      { className: "kv" },
      h(
        "div",
        {},
        h("dt", {}, "IMD record · Data shown here"),
        h(
          "dd",
          {},
          external(`${C.EXPLORER}/address/${C.PASS_ADDRESS}`, C.PASS_ADDRESS),
        ),
      ),
      h(
        "div",
        {},
        h("dt", {}, "Address in the request · Not selected"),
        h(
          "dd",
          {},
          external(
            `${C.EXPLORER}/address/${C.REQUESTED_PASS_ADDRESS}`,
            C.REQUESTED_PASS_ADDRESS,
          ),
        ),
      ),
    ),
    h(
      "p",
      {},
      "No public approval, mint or reveal is enabled. The owner must reconcile the deployment, obtain independent review and separately authorize opening.",
    ),
  );
}
function CollectionSummary() {
  const s = usePlatform();
  return h(
    "section",
    { className: "section collection-summary" },
    h("h1", {}, "BMC Illuminati Pass"),
    h(
      "p",
      {},
      "500 Ethereum collectibles. Explore the real artwork and read collection data before minting opens.",
    ),
    h("a", { href: "./mint/", className: "btn btn-primary" }, "Open mint page"),
    h(DeploymentNotice),
    h(ReadStatus),
  );
}
function ArtworkGallery() {
  const [kind, setKind] = ne.useState("genesis"),
    [count, setCount] = ne.useState(8),
    [failed, setFailed] = ne.useState(false);
  const standard = kind === "standard";
  const maximum = standard ? 12 : 77;
  return h(
    "section",
    {
      className: "section actual-gallery",
      "aria-labelledby": "actual-gallery-title",
    },
    h(
      "div",
      { className: "section-head" },
      h("h2", { id: "actual-gallery-title" }, "Inside the collection"),
      h(
        "p",
        {},
        standard
          ? "Standard previews rendered by the unchanged Solidity library. Artwork IDs are not token IDs or promised mint outcomes."
          : "77 authentic Genesis artworks from the contract IPFS directory. Local previews keep the gallery available offline.",
      ),
    ),
    h(
      "div",
      { className: "segmented", role: "group", "aria-label": "Artwork type" },
      ...["genesis", "standard"].map((k) =>
        h(
          "button",
          {
            key: k,
            "aria-pressed": kind === k,
            onClick: () => {
              setKind(k);
              setCount(8);
              setFailed(false);
            },
          },
          k === "genesis" ? "Genesis · 77" : "Standard · On-chain SVG",
        ),
      ),
    ),
    failed
      ? h(
          "p",
          { className: "field-error", role: "status" },
          "An artwork preview could not load. The original remains linked below.",
        )
      : null,
    h(
      "div",
      { className: "art-grid" },
      ...Array.from({ length: Math.min(count, maximum) }, (_, i) => {
        const n = i + 1,
          file = "genesis-" + String(n).padStart(2, "0") + ".png";
        return h(
          "figure",
          { key: kind + n },
          h("img", {
            src: standard
              ? `./artwork/standard/standard-${n}.svg`
              : `./artwork/genesis/genesis-${String(n).padStart(2, "0")}.webp`,
            alt: standard
              ? `Standard artwork ${n} from the contract renderer`
              : `Genesis artwork ${n}`,
            width: 480,
            height: 480,
            loading: "lazy",
            onError: () => setFailed(true),
          }),
          h(
            "figcaption",
            {},
            h(
              "strong",
              {},
              `${standard ? "Standard" : "Genesis"} #${String(n).padStart(2, "0")}`,
            ),
            h(
              "span",
              { className: "muted" },
              standard
                ? "Solidity preview"
                : n === 1
                  ? "Legendary"
                  : n <= 40
                    ? "Early Genesis"
                    : "Mystery inventory",
            ),
            standard
              ? external(
                  `${C.GITHUB}/blob/${C.LAUNCH.SOURCE_COMMIT}/src/StandardArt.sol`,
                  "View renderer",
                )
              : external(
                  `${C.IPFS_GATEWAY}${C.GENESIS_CID}/${file}`,
                  "Original on IPFS",
                ),
          ),
        );
      }),
    ),
    count < maximum
      ? h(
          "button",
          {
            className: "btn btn-secondary",
            onClick: () => setCount((c) => c + 12),
          },
          "Show more artwork",
        )
      : null,
    standard
      ? h(
          "p",
          { className: "muted" },
          "12 of the 423 possible Standard artworks are previewed here. Minted metadata is read from tokenURI on the mint page.",
        )
      : null,
  );
}
function StakingPage() {
  const s = usePlatform();
  const [amount, setAmount] = ne.useState("");
  const invalid =
    amount !== "" &&
    (!/^\d+(\.\d{1,18})?$/.test(amount) || !/[1-9]/.test(amount));
  return h(
    "section",
    { className: "section staking-page" },
    h("h1", {}, "Stake BMC"),
    h(
      "p",
      { className: "lead" },
      "Your BMC, your wallet. Deposits open only with verified contract terms.",
    ),
    h(
      "div",
      { className: "notice notice-warn" },
      h("strong", {}, "Deposits disabled"),
      h(
        "p",
        {},
        "No verified Ethereum staking deployment was found in the project records. No token approval or transfer can be requested here.",
      ),
      external(C.STAKING.source, "Inspect the staking source"),
    ),
    h(
      "div",
      { className: "staking-layout" },
      h(
        "div",
        { className: "stake-form" },
        h("h2", {}, "Prepare a deposit"),
        h(WalletControls),
        h(
          "p",
          {},
          "Available: ",
          h(
            "strong",
            {},
            s.wallet.account
              ? `${P.format(s.wallet.balance)} BMC`
              : "Connect wallet",
          ),
        ),
        h("label", { htmlFor: "stake-amount" }, "Amount in BMC"),
        h(
          "div",
          { className: "amount-input" },
          h("input", {
            id: "stake-amount",
            name: "stakeAmount",
            value: amount,
            inputMode: "decimal",
            autoComplete: "off",
            placeholder: "0.00",
            "aria-invalid": invalid,
            "aria-describedby": "stake-help",
            onChange: (e) => setAmount(e.target.value),
          }),
          h("span", {}, "BMC"),
        ),
        h(
          "p",
          { id: "stake-help", className: invalid ? "field-error" : "muted" },
          invalid
            ? "Use a positive decimal amount with no more than 18 decimal places."
            : "Approval will be limited to the exact deposit after a reviewed contract is available.",
        ),
        h(
          "button",
          {
            className: "btn btn-primary",
            disabled: true,
            "aria-describedby": "staking-terms",
          },
          "Approve BMC",
        ),
        h(
          "button",
          {
            className: "btn btn-secondary",
            disabled: true,
            "aria-describedby": "staking-terms",
          },
          "Stake BMC",
        ),
      ),
      h(
        "div",
        { className: "staking-position" },
        h("h2", {}, "My staking"),
        h(
          "dl",
          { className: "kv" },
          ...[
            "BMC deposited",
            "Earned rewards",
            "Unlock date / withdrawal terms",
            "Reward pool funding",
          ].map((label) =>
            h(
              "div",
              { key: label },
              h("dt", {}, label),
              h("dd", {}, "Not available"),
            ),
          ),
        ),
        h(
          "p",
          { id: "staking-terms", className: "muted" },
          "The contract address, administrator rights, reward funding and withdrawal rules are not verified. Do not send funds to an address advertised as a staking pool.",
        ),
        h(
          "div",
          { className: "row" },
          h(
            "button",
            { className: "btn btn-secondary", disabled: true },
            "Unstake BMC",
          ),
          h(
            "button",
            { className: "btn btn-secondary", disabled: true },
            "Claim rewards",
          ),
        ),
        h("p", { role: "status" }, "No staking transaction submitted."),
      ),
    ),
    h(
      "div",
      { className: "staking-risks" },
      h("h2", {}, "Before staking opens"),
      h(
        "p",
        {},
        "Staking can expose funds to contract bugs, administrator powers, lockups and depleted reward pools. Deposits, withdrawals and claims will require separate wallet confirmations. Rewards are never guaranteed.",
      ),
    ),
  );
}
function PersonalDashboard() {
  const s = usePlatform();
  const [tokens, setTokens] = ne.useState(null),
    [busy, setBusy] = ne.useState(false),
    [error, setError] = ne.useState("");
  ne.useEffect(() => {
    setTokens(null);
    setError("");
  }, [s.wallet.account, s.wallet.chainId]);
  async function load() {
    setBusy(true);
    setError("");
    const account = s.wallet.account;
    try {
      const result = await P.ownedTokens();
      if (P.snapshot().wallet.account === account) setTokens(result);
    } catch (e) {
      setError(window.BMCMint.friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return h(
    "section",
    { className: "section personal-dashboard" },
    h("h1", {}, "Your BMC dashboard"),
    h(
      "p",
      {},
      "Token balances and Pass ownership on Ethereum. Unknown values stay unknown.",
    ),
    h(WalletControls),
    s.wallet.account
      ? h("p", { className: "address-full" }, s.wallet.account)
      : null,
    h(
      "div",
      { className: "dashboard-values" },
      h(
        "div",
        {},
        h("span", {}, "BMC balance"),
        h(
          "strong",
          {},
          s.wallet.account ? P.format(s.wallet.balance) : "Connect wallet",
        ),
      ),
      h(
        "div",
        {},
        h("span", {}, "Passes in wallet"),
        h(
          "strong",
          {},
          s.personal
            ? String(s.personal.passes)
            : s.wallet.account
              ? "Unavailable"
              : "Connect wallet",
        ),
      ),
      h(
        "div",
        {},
        h("span", {}, "Earned staking rewards"),
        h("strong", {}, "Not available"),
      ),
    ),
    h(
      "div",
      { className: "dashboard-values" },
      h(
        "div",
        {},
        h("span", {}, "Minted / Maximum"),
        h("strong", {}, s.public ? `${s.public.minted} / 500` : "Unavailable"),
      ),
      h(
        "div",
        {},
        h("span", {}, "BMC burned by this Pass contract"),
        h("strong", {}, s.public ? P.format(s.public.burned) : "Unavailable"),
      ),
      h(
        "div",
        {},
        h("span", {}, "ETH for network fees"),
        h("strong", {}, P.format(s.personal?.eth)),
      ),
    ),
    h(ReadStatus),
    h(DeploymentNotice),
    h("h2", {}, "Passes you own"),
    h(
      "button",
      {
        className: "btn btn-secondary",
        disabled: !s.wallet.account || s.wallet.chainId !== "0x1" || busy,
        onClick: load,
      },
      busy ? "Reading ownership…" : "Find my Passes",
    ),
    h(
      "p",
      { role: "status" },
      error ||
        (tokens?.length === 0
          ? "No Passes found for this wallet in the displayed deployment."
          : tokens === null
            ? "Connect, then read current ownership from the collection."
            : ""),
    ),
    tokens?.length
      ? h(
          "ul",
          {},
          ...tokens.map((id) =>
            h(
              "li",
              { key: String(id) },
              h("a", { href: `./mint/?token=${id}` }, `View Pass #${id}`),
            ),
          ),
        )
      : null,
    h(
      "p",
      { className: "muted" },
      "Ownership is checked against up to 500 token IDs. Staking rewards remain unavailable until a funded deployment is verified.",
    ),
  );
}

const jn = {
    name: "BMC Illuminati",
    nameUpper: "BMC Illuminati",
    slogan: "Know · Create · Burn · Rise",
    subtitle:
      "500 Ethereum collectibles. Mint a Pass by permanently burning BMC.",
  },
  Le = {
    total: 500,
    genesis: 77,
    standard: 423,
    earlyMints: 40,
    earlyPriceBmc: 1e6,
    mysteryPriceBmc: 35e4,
    mysteryGenesis: 37,
    maxBurnBmc: 201e6,
  },
  Vw = [
    { label: "BMC token staking", pct: 55 },
    { label: "BMC PASS staking", pct: 25 },
    { label: "Combined bonus", pct: 15 },
    { label: "Reserve", pct: 5 },
  ],
  Xw = [
    {
      tier: "Standard",
      weight: "1×",
      count: 423,
      note: "Unique on-chain SVG character",
    },
    {
      tier: "Random Genesis",
      weight: "2×",
      count: 37,
      note: "Genesis drawn from the mystery mints",
    },
    {
      tier: "Early Genesis",
      weight: "3×",
      count: 39,
      note: "Genesis #2–40 from the first 40 mints",
    },
    {
      tier: "Legendary Genesis #1",
      weight: "5×",
      count: 1,
      note: "First successful mint",
    },
  ],
  ol = 1,
  nc = "Ethereum Mainnet",
  Zw = "https://etherscan.io",
  Gr = "0x38224239f2BDae357D47cb864BC533d7f72dF961",
  Xu = {
    pass: {
      address: null,
      label: "BMC PASS (ERC-721)",
      job: "2aa0f8fa-379e-459b-a814-480f8c428c4f",
      note: "Two NFT deployment records disagree. Minting is locked until the address and independent security review are approved.",
    },
    tokenStaking: {
      address: null,
      label: "BMC token staking",
      job: "fa117565-998a-4aaa-ad09-233e642d4c1e",
      note: "Opens once the staking contracts are deployed, reviewed and funded.",
    },
    passStaking: {
      address: null,
      label: "BMC PASS staking",
      job: "fa117565-998a-4aaa-ad09-233e642d4c1e",
      note: "Opens once the staking contracts are deployed, reviewed and funded.",
    },
    combinedStaking: {
      address: null,
      label: "Combined staking bonus",
      job: "fa117565-998a-4aaa-ad09-233e642d4c1e",
      note: "Opens once the bonus pool is deployed, reviewed and funded.",
    },
    imdToken: {
      address: null,
      label: "IMD token",
      note: "The official IMD contract, network and burn mechanism must be verified before burns open.",
    },
    swapRoute: {
      address: null,
      label: "ETH/BMC swap route",
      note: "No verified liquidity route was found on Uniswap V2 or V3 for BMC/WETH. Swaps stay disabled until an established DEX route is verified.",
    },
  };
function At(a) {
  return Xu[a].address !== null;
}
const Iw = [
    {
      type: "function",
      name: "name",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }],
    },
    {
      type: "function",
      name: "symbol",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }],
    },
    {
      type: "function",
      name: "decimals",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint8" }],
    },
    {
      type: "function",
      name: "totalSupply",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint256" }],
    },
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
  ],
  ac = [
    { path: "/", label: "Home" },
    { path: "/pass", label: "BMC PASS" },
    { path: "/swap", label: "Swap" },
    { path: "/staking", label: "Staking" },
    { path: "/burns", label: "IMD Burns" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/community", label: "Community" },
  ];
function Bb(a) {
  const r = (a.replace(/^#/, "") || "/").split("?")[0];
  return ac.find((c) => c.path === r)?.path ?? "/";
}
function Kw() {
  const [a, l] = ne.useState(() =>
    Bb(typeof window > "u" ? "" : window.location.hash),
  );
  return (
    ne.useEffect(() => {
      const r = () => l(Bb(window.location.hash));
      return (
        window.addEventListener("hashchange", r),
        () => window.removeEventListener("hashchange", r)
      );
    }, []),
    a
  );
}
function En({ to: a, className: l, children: r, ...c }) {
  return m.jsx("a", { href: `#${a}`, className: l, ...c, children: r });
}
function fe({
  children: a,
  tone: l,
  compact: r,
  className: c = "",
  as: o = "div",
}) {
  const d = [
    "card",
    l ? `card-tone-${l}` : "",
    r ? "card-compact" : "",
    c,
  ].join(" ");
  return m.jsx(o, { className: d, children: a });
}
function be({ label: a, value: l, note: r, tone: c }) {
  return m.jsxs("div", {
    className: "stat",
    children: [
      m.jsx("span", { className: "stat-label", children: a }),
      m.jsx("span", { className: `stat-value ${c ?? ""}`, children: l }),
      r ? m.jsx("span", { className: "stat-note", children: r }) : null,
    ],
  });
}
function Ma({ children: a, tone: l }) {
  return m.jsx("span", {
    className: `badge ${l ? `badge-${l}` : ""}`,
    children: a,
  });
}
function yl({ title: a, children: l, tone: r }) {
  return m.jsxs("div", {
    className: `notice ${r ? `notice-${r}` : ""}`,
    role: "note",
    children: [m.jsx("strong", { children: a }), l],
  });
}
function Qr({ integration: a, extra: l }) {
  const r = Xu[a];
  return m.jsxs(yl, {
    title: `${r.label}: coming soon`,
    children: [m.jsx("p", { children: r.note }), l],
  });
}
function Ft({ title: a, children: l, id: r }) {
  return m.jsxs("div", {
    className: "section-head",
    children: [
      m.jsx("h2", { id: r, tabIndex: r ? -1 : void 0, children: a }),
      l,
    ],
  });
}
function ic({ address: a, label: l }) {
  return m.jsx("a", {
    href: `${Zw}/address/${a}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "break mono",
    children: l ?? a,
  });
}
function Pw({ value: a, max: l, label: r }) {
  const c = l > 0 ? Math.min(100, Math.round((a / l) * 100)) : 0;
  return m.jsx("div", {
    className: "progress",
    role: "progressbar",
    "aria-label": r,
    "aria-valuemin": 0,
    "aria-valuemax": l,
    "aria-valuenow": a,
    children: m.jsx("span", { style: { width: `${c}%` } }),
  });
}
function kw() {
  return m.jsx("footer", {
    className: "footer",
    children: m.jsxs("div", {
      className: "container footer-inner",
      children: [
        h(CommunityLinks),
        h(
          "button",
          {
            className: "btn btn-ghost",
            onClick: () => window.dispatchEvent(new Event("bmc:replay-intro")),
          },
          "Replay brand intro",
        ),
        m.jsxs("div", {
          className: "stack",
          children: [
            m.jsx("strong", {
              style: { color: "var(--color-text)" },
              children: jn.nameUpper,
            }),
            m.jsx("span", { children: jn.slogan }),
            m.jsxs("span", {
              className: "caption",
              children: ["BMC token on ", nc, ": ", m.jsx(ic, { address: Gr })],
            }),
            m.jsx("span", {
              className: "caption",
              children:
                "Nothing on this site is financial advice. Rewards come only from funded pools; no APY is guaranteed.",
            }),
          ],
        }),
        m.jsx("nav", {
          "aria-label": "Footer",
          children: m.jsx("ul", {
            children: ac.map((a) =>
              m.jsx(
                "li",
                { children: m.jsx(En, { to: a.path, children: a.label }) },
                a.path,
              ),
            ),
          }),
        }),
      ],
    }),
  });
}
function oi({
  variant: a = "logo",
  className: l = "",
  animated: r = !1,
  title: c,
}) {
  const o = a === "pyramid",
    d = o ? "var(--color-accent)" : "var(--color-mystic)";
  return m.jsxs("svg", {
    viewBox: "0 0 120 120",
    className: `emblem ${r ? "emblem-animated" : ""} ${l}`,
    role: c ? "img" : void 0,
    "aria-hidden": c ? void 0 : !0,
    "aria-label": c,
    children: [
      m.jsx("defs", {
        children: m.jsxs("linearGradient", {
          id: `g-${a}`,
          x1: "0",
          y1: "0",
          x2: "1",
          y2: "1",
          children: [
            m.jsx("stop", { offset: "0", stopColor: d }),
            m.jsx("stop", { offset: "1", stopColor: "var(--color-cyber)" }),
          ],
        }),
      }),
      m.jsx("path", {
        d: "M60 10 L110 100 H10 Z",
        fill: "none",
        stroke: `url(#g-${a})`,
        strokeWidth: "5",
        strokeLinejoin: "round",
      }),
      m.jsx("path", {
        d: "M60 32 L92 90 H28 Z",
        fill: "none",
        stroke: d,
        strokeWidth: "1.5",
        opacity: "0.5",
      }),
      m.jsx("ellipse", {
        cx: "60",
        cy: "70",
        rx: "22",
        ry: "12",
        fill: "none",
        stroke: "var(--color-legend)",
        strokeWidth: "4",
      }),
      m.jsx("circle", {
        className: "eye-pupil",
        cx: "60",
        cy: "70",
        r: "7",
        fill: d,
      }),
      m.jsx("circle", { cx: "63", cy: "67", r: "2", fill: "#fff" }),
    ],
  });
}
function mt(a) {
  return new Intl.NumberFormat("en-US").format(a);
}
function Na(a, l = 18, r = 2) {
  if (a === void 0) return "—";
  const c = Number(Yu(a, l));
  return Number.isFinite(c)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: r }).format(c)
    : Yu(a, l);
}
function Fw(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
const Du = { early: { count: 40, priceBmc: 1e6 }, mystery: { priceBmc: 35e4 } };
function Jw(a) {
  const l = Math.max(0, Math.min(500, Math.floor(a))),
    r = Math.min(l, Du.early.count),
    c = l - r;
  return r * Du.early.priceBmc + c * Du.mystery.priceBmc;
}
function Ub(a) {
  return Du.early.priceBmc;
}
function Zu({ compact = false } = {}) {
  return h(WalletControls, { compact, quiet: true });
}

function lc() {
  const s = usePlatform();
  return s.wallet.account && s.wallet.chainId !== "0x1"
    ? h(
        "div",
        { className: "notice notice-warn", role: "status" },
        "Wrong network. Switch your wallet to Ethereum Mainnet (chain ID 1).",
      )
    : null;
}

function Ww({ route: a }) {
  const [l, r] = ne.useState(!1),
    c = ne.useRef(null);
  (ne.useEffect(() => r(!1), [a]),
    ne.useEffect(() => {
      if (!l) return;
      const d = (h) => {
        h.key === "Escape" && (r(!1), c.current?.focus());
      };
      return (
        window.addEventListener("keydown", d),
        () => window.removeEventListener("keydown", d)
      );
    }, [l]));
  const o = ac.map((d) =>
    m.jsx(
      "li",
      {
        children: m.jsx(En, {
          to: d.path,
          className: "nav-link",
          "aria-current": a === d.path ? "page" : void 0,
          children: d.label,
        }),
      },
      d.path,
    ),
  );
  return m.jsxs("header", {
    className: "header",
    children: [
      m.jsxs("div", {
        className: "container header-inner",
        children: [
          m.jsxs(En, {
            to: "/",
            className: "brand",
            "aria-label": `${jn.name} home`,
            children: [
              m.jsx(oi, { variant: "logo", animated: !0 }),
              m.jsx("span", { children: jn.nameUpper }),
            ],
          }),
          m.jsx("nav", {
            className: "nav-desktop",
            "aria-label": "Main",
            children: m.jsx("ul", { children: o }),
          }),
          m.jsxs("div", {
            className: "header-actions",
            children: [
              m.jsx("div", {
                className: "header-wallet",
                children: m.jsx(Zu, { compact: true }),
              }),
              m.jsx("button", {
                ref: c,
                type: "button",
                className: "icon-btn nav-toggle",
                "aria-expanded": l,
                "aria-controls": "mobile-nav",
                "aria-label": l ? "Close menu" : "Open menu",
                onClick: () => r((d) => !d),
                children: m.jsx("svg", {
                  width: "22",
                  height: "22",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2",
                  "aria-hidden": "true",
                  children: l
                    ? m.jsx("path", {
                        d: "M6 6l12 12M18 6L6 18",
                        strokeLinecap: "round",
                      })
                    : m.jsx("path", {
                        d: "M4 7h16M4 12h16M4 17h16",
                        strokeLinecap: "round",
                      }),
                }),
              }),
            ],
          }),
        ],
      }),
      h(CommunityLinks, { compact: true }),
      l
        ? m.jsxs("nav", {
            id: "mobile-nav",
            className: "nav-mobile container",
            "aria-label": "Main",
            children: [
              m.jsx("ul", { children: o }),
              m.jsx("div", {
                style: { marginBlockStart: "var(--space-3)" },
                children: m.jsx(Zu, {}),
              }),
            ],
          })
        : null,
    ],
  });
}
const Hb = "(prefers-reduced-motion: reduce)";
function lg() {
  const [a, l] = ne.useState(() =>
    typeof window < "u" && "matchMedia" in window
      ? window.matchMedia(Hb).matches
      : !1,
  );
  return (
    ne.useEffect(() => {
      const r = window.matchMedia(Hb),
        c = () => l(r.matches);
      return (
        r.addEventListener("change", c),
        () => r.removeEventListener("change", c)
      );
    }, []),
    a
  );
}
const qb = "01アイウエオカキクケコサシスセソ∆ΣΩΞΨ0123456789ABCDEF";
function rg({ intensity: a = 0.4, dense: l = !1 }) {
  const r = ne.useRef(null),
    c = lg();
  return (
    ne.useEffect(() => {
      const o = r.current;
      if (!o || c) return;
      const d = o.getContext("2d");
      if (!d) return;
      let h = 0,
        y = [],
        b = [];
      const g = l ? 16 : 18,
        S = Math.min(window.devicePixelRatio || 1, 2),
        v = () => {
          const { innerWidth: A, innerHeight: z } = window;
          ((o.width = A * S),
            (o.height = z * S),
            d.setTransform(S, 0, 0, S, 0, 0));
          const Z = Math.ceil(A / g);
          y = Array.from({ length: Z }, () => Math.random() * -50);
          const G = Math.max(12, Math.floor(A / 60));
          b = Array.from({ length: G }, () => ({
            x: Math.random() * A,
            y: Math.random() * z,
            r: 1 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 0.15,
            vy: -0.1 - Math.random() * 0.25,
            c: ["#00FF88", "#9B4DFF", "#00D4FF", "#D4AF37"][
              Math.floor(Math.random() * 4)
            ],
          }));
        };
      let w = 0;
      const E = (A) => {
          if (((h = requestAnimationFrame(E)), A - w < 60)) return;
          w = A;
          const z = window.innerWidth,
            Z = window.innerHeight;
          ((d.fillStyle = "rgba(5, 7, 11, 0.14)"),
            d.fillRect(0, 0, z, Z),
            (d.font = `${g}px ui-monospace, Menlo, monospace`));
          for (let G = 0; G < y.length; G++) {
            if (Math.random() > a) continue;
            const V = qb[Math.floor(Math.random() * qb.length)],
              F = G * g,
              U = y[G] * g;
            ((d.fillStyle = Math.random() > 0.92 ? "#CFFFE8" : "#00FF88"),
              (d.globalAlpha = 0.55),
              d.fillText(V, F, U),
              (d.globalAlpha = 1),
              U > Z && Math.random() > 0.975 && (y[G] = 0),
              (y[G] += 1));
          }
          for (const G of b)
            ((G.x += G.vx),
              (G.y += G.vy),
              G.y < -5 && ((G.y = Z + 5), (G.x = Math.random() * z)),
              d.beginPath(),
              (d.fillStyle = G.c),
              (d.globalAlpha = 0.7),
              d.arc(G.x, G.y, G.r, 0, Math.PI * 2),
              d.fill(),
              (d.globalAlpha = 1));
        },
        R = () => {
          document.hidden
            ? cancelAnimationFrame(h)
            : (h = requestAnimationFrame(E));
        };
      return (
        v(),
        (h = requestAnimationFrame(E)),
        window.addEventListener("resize", v),
        document.addEventListener("visibilitychange", R),
        () => {
          (cancelAnimationFrame(h),
            window.removeEventListener("resize", v),
            document.removeEventListener("visibilitychange", R));
        }
      );
    }, [c, a, l]),
    c ? null : m.jsx("canvas", { ref: r, "aria-hidden": "true" })
  );
}
const sg = "bmc-intro-seen",
  ex = 3200,
  Lb = "01∆ΣΩ#%&ABCDEF";
function tx({ onDone: a }) {
  const l = lg(),
    [r, c] = ne.useState(""),
    o = ne.useRef(null),
    d = ne.useRef(!1),
    h = () => {
      if (!d.current) {
        d.current = !0;
        try {
          sessionStorage.setItem(sg, "1");
        } catch {}
        a();
      }
    };
  return (
    ne.useEffect(() => {
      if (l) {
        h();
        return;
      }
      o.current?.focus();
      const y = jn.nameUpper,
        b = performance.now();
      let g = 0;
      const S = (E) => {
        const R = Math.min(1, (E - b) / 1600),
          A = Math.floor(R * y.length);
        let z = "";
        for (let Z = 0; Z < y.length; Z++)
          y[Z] === " "
            ? (z += " ")
            : Z < A
              ? (z += y[Z])
              : (z += Lb[Math.floor(Math.random() * Lb.length)]);
        (c(z), R < 1 ? (g = requestAnimationFrame(S)) : c(y));
      };
      g = requestAnimationFrame(S);
      const v = window.setTimeout(h, ex),
        w = (E) => {
          (E.key === "Escape" || E.key === "Enter") && h();
        };
      return (
        window.addEventListener("keydown", w),
        () => {
          (cancelAnimationFrame(g),
            window.clearTimeout(v),
            window.removeEventListener("keydown", w));
        }
      );
    }, [l]),
    l
      ? null
      : m.jsxs("div", {
          className: "intro",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Intro animation",
          children: [
            m.jsx(rg, { intensity: 0.9, dense: !0 }),
            m.jsxs("div", {
              className: "intro-center",
              children: [
                m.jsx(oi, { variant: "pyramid", animated: !0 }),
                m.jsx("p", {
                  className: "intro-title",
                  "aria-live": "off",
                  children: r || " ",
                }),
                m.jsxs("p", {
                  className: "visually-hidden",
                  children: [jn.nameUpper, ". Loading the encrypted gateway."],
                }),
              ],
            }),
            m.jsx("button", {
              ref: o,
              type: "button",
              className: "btn btn-secondary btn-sm intro-skip",
              onClick: h,
              children: "Skip intro",
            }),
          ],
        })
  );
}
function nx() {
  try {
    return sessionStorage.getItem(sg) === "1";
  } catch {
    return !1;
  }
}
const mr = [];
function ax() {
  const a = At("imdToken"),
    [l, r] = ne.useState(""),
    [c, o] = ne.useState(!1),
    d = Number(l),
    h = l !== "" && (!Number.isFinite(d) || d <= 0);
  return m.jsxs(m.Fragment, {
    children: [
      m.jsxs("section", {
        className: "section",
        children: [
          m.jsxs("div", {
            className: "section-head",
            children: [
              m.jsx("h1", {
                style: { fontSize: "var(--text-xl)" },
                children: "IMD Burn Center",
              }),
              m.jsx("p", { children: "Four ways IMD leaves circulation." }),
            ],
          }),
          m.jsx(lc, {}),
          a ? null : m.jsx(Qr, { integration: "imdToken" }),
          m.jsxs("div", {
            className: "grid grid-2",
            children: [
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "1. Voluntary burn" }),
                  m.jsx("p", {
                    children:
                      "Burn IMD permanently. Choose an amount to send to the verified burn mechanism. It can never be recovered.",
                  }),
                  m.jsxs("div", {
                    className: "field",
                    children: [
                      m.jsx("label", {
                        htmlFor: "burn-amount",
                        children: "Amount to burn",
                      }),
                      m.jsxs("div", {
                        className: "input-group",
                        children: [
                          m.jsx("input", {
                            id: "burn-amount",
                            inputMode: "decimal",
                            autoComplete: "off",
                            placeholder: "0.0",
                            value: l,
                            onChange: (y) =>
                              r(y.target.value.replace(",", ".")),
                            "aria-invalid": h || void 0,
                            "aria-describedby": h
                              ? "burn-amount-error"
                              : "burn-amount-help",
                            disabled: !a,
                          }),
                          m.jsx("span", {
                            className: "token-chip",
                            children: "IMD",
                          }),
                        ],
                      }),
                      h
                        ? m.jsx("span", {
                            id: "burn-amount-error",
                            className: "field-error",
                            children: "Enter an amount greater than zero.",
                          })
                        : m.jsx("span", {
                            id: "burn-amount-help",
                            className: "field-help",
                            children:
                              "Burning is irreversible. Double-check the amount.",
                          }),
                    ],
                  }),
                  m.jsxs("label", {
                    className: "row",
                    style: { gap: "var(--space-2)", minHeight: 44 },
                    children: [
                      m.jsx("input", {
                        type: "checkbox",
                        checked: c,
                        onChange: (y) => o(y.target.checked),
                        disabled: !a,
                      }),
                      m.jsx("span", {
                        className: "small",
                        children: "I understand burned IMD is gone forever",
                      }),
                    ],
                  }),
                  m.jsx("button", {
                    type: "button",
                    className: "btn btn-primary",
                    disabled: !a || !c || h || l === "",
                    children: "Burn IMD",
                  }),
                ],
              }),
              m.jsxs(fe, {
                tone: "mystic",
                children: [
                  m.jsx("h3", { children: "2. PASS customisation" }),
                  m.jsx("p", {
                    children:
                      "Burn IMD to unlock optional website profile frames, animated badges and visual themes. These live on this site only and never modify immutable PASS metadata.",
                  }),
                  m.jsx(be, {
                    label: "Unlocked items",
                    value: a ? "—" : "Coming soon",
                  }),
                  m.jsx("button", {
                    type: "button",
                    className: "btn btn-secondary btn-sm",
                    disabled: !a,
                    children: "Browse unlockables",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "3. Community privileges" }),
                  m.jsx("p", {
                    children:
                      "Burn IMD for documented non-financial community roles, badges and event eligibility. Privileges carry no financial value and are listed publicly before they open.",
                  }),
                  m.jsx(be, {
                    label: "Available privileges",
                    value: a ? "—" : "Coming soon",
                  }),
                  m.jsx("button", {
                    type: "button",
                    className: "btn btn-secondary btn-sm",
                    disabled: !a,
                    children: "View privileges",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "4. Manual buyback and burn" }),
                  m.jsx("p", {
                    children:
                      "BMC transaction fees accumulate in the operator’s existing main wallet. The operator manually allocates funds, buys IMD through a verified DEX route and manually burns it. No automation, no treasury withdrawals, no private-key access from this site.",
                  }),
                  m.jsx("a", {
                    href: "#buybacks",
                    className: "small",
                    onClick: (y) => {
                      (y.preventDefault(),
                        document.getElementById("buybacks")?.focus(),
                        document.getElementById("buybacks")?.scrollIntoView());
                    },
                    children: "See the buyback dashboard",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "buybacks",
        children: [
          m.jsx(Ft, {
            title: "Buyback dashboard",
            id: "buybacks",
            children: m.jsx("p", {
              children:
                "Purchased IMD and burned IMD are listed separately. Bought is not burned until its burn transaction confirms.",
            }),
          }),
          m.jsxs("div", {
            className: "grid grid-3",
            children: [
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "IMD purchased (verified)",
                  value: mr.length ? "—" : "Coming soon",
                  tone: "cyber",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "IMD burned (verified)",
                  value: mr.length ? "—" : "Coming soon",
                  tone: "accent",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Completed buybacks",
                  value: mr.length,
                }),
              }),
            ],
          }),
          mr.length === 0
            ? m.jsx(yl, {
                title: "No verified buybacks yet",
                children: m.jsx("p", {
                  children:
                    "The first manual buyback will appear here with its purchase transaction, burn transaction and explorer links once the operator records it.",
                }),
              })
            : m.jsx("div", {
                className: "table-wrap",
                children: m.jsxs("table", {
                  children: [
                    m.jsx("thead", {
                      children: m.jsxs("tr", {
                        children: [
                          m.jsx("th", { scope: "col", children: "Date" }),
                          m.jsx("th", { scope: "col", children: "IMD bought" }),
                          m.jsx("th", { scope: "col", children: "IMD burned" }),
                          m.jsx("th", {
                            scope: "col",
                            children: "Transactions",
                          }),
                        ],
                      }),
                    }),
                    m.jsx("tbody", {
                      children: mr.map((y) =>
                        m.jsxs(
                          "tr",
                          {
                            children: [
                              m.jsx("td", { children: y.date }),
                              m.jsx("td", {
                                className: "num",
                                children: y.boughtImd,
                              }),
                              m.jsx("td", {
                                className: "num",
                                children: y.burnedImd,
                              }),
                              m.jsxs("td", {
                                children: [
                                  m.jsx("a", {
                                    href: `https://etherscan.io/tx/${y.buyTx}`,
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    children: "Purchase",
                                  }),
                                  " ",
                                  "·",
                                  " ",
                                  m.jsx("a", {
                                    href: `https://etherscan.io/tx/${y.burnTx}`,
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    children: "Burn",
                                  }),
                                ],
                              }),
                            ],
                          },
                          y.buyTx,
                        ),
                      ),
                    }),
                  ],
                }),
              }),
        ],
      }),
    ],
  });
}
const ix = [
    { name: "Telegram", url: null },
    { name: "X (Twitter)", url: null },
  ],
  lx = [
    {
      q: "What is BMC?",
      a: "BMC Illuminati (BMC) is an ERC-20 token on Ethereum mainnet. Its contract address is shown in the footer and on the dashboard. The ecosystem uses the existing token only; no new token is created.",
    },
    {
      q: "What is a BMC PASS?",
      a: `A BMC PASS is one of ${Le.total} ERC-721 collectibles. ${Le.genesis} are Genesis and ${Le.standard} are Standard. Minting burns BMC, so each PASS permanently removes BMC from circulation.`,
    },
    {
      q: "Why is minting, staking or swapping disabled?",
      a: "Each action opens only after its contract or liquidity route is deployed, reviewed and verified. Until then the site shows the rules and “Coming soon” instead of a live button, so nobody can send funds to an unverified address.",
    },
    {
      q: "Do I earn a guaranteed yield from staking?",
      a: "No. Rewards are paid only in BMC from pools the operator funds. There is no fixed APY and no new BMC issuance. If a pool is empty, nothing is paid.",
    },
    {
      q: "What does burning IMD get me?",
      a: "Voluntary burns get you nothing but a smaller IMD supply. Customisation and privilege burns unlock website-only cosmetics or documented non-financial community roles. None of it changes the metadata of a PASS.",
    },
  ];
function rx() {
  return m.jsxs(m.Fragment, {
    children: [
      h(CommunityLinks, { expanded: true }),
      m.jsxs("section", {
        className: "section",
        children: [
          m.jsxs("div", {
            className: "section-head",
            children: [
              m.jsx("h1", {
                style: { fontSize: "var(--text-xl)" },
                children: "Community",
              }),
              m.jsx("p", {
                children:
                  "Project information, announcements, official channels and the safety basics every collector should know.",
              }),
            ],
          }),
          m.jsxs("div", {
            className: "grid grid-2",
            children: [
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "About the project" }),
                  m.jsxs("p", {
                    children: [
                      jn.name,
                      " is the encrypted gateway to the BMC ecosystem: a ",
                      Le.total,
                      "-piece PASS collection, an ETH/BMC swap, three staking options and an IMD burn center, all on Ethereum mainnet.",
                    ],
                  }),
                  m.jsxs("p", {
                    className: "caption",
                    children: ["BMC token: ", m.jsx(ic, { address: Gr })],
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Announcements" }),
                  m.jsx("p", {
                    children:
                      "No announcements yet. Contract deployments, verified routes and mint dates will be posted here first.",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Official channels" }),
                  m.jsx("ul", {
                    className: "small muted",
                    children: ix.map((a) =>
                      m.jsx(
                        "li",
                        {
                          children: a.url
                            ? m.jsx("a", {
                                href: a.url,
                                target: "_blank",
                                rel: "noopener noreferrer",
                                children: a.name,
                              })
                            : m.jsxs("span", {
                                children: [
                                  a.name,
                                  ": not yet published by the owner",
                                ],
                              }),
                        },
                        a.name,
                      ),
                    ),
                  }),
                  m.jsx("p", {
                    className: "caption",
                    children:
                      "Only links listed here are official. Treat any other account claiming to be BMC Illuminati as unverified.",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Collector education" }),
                  m.jsxs("ul", {
                    className: "small muted",
                    children: [
                      m.jsx("li", {
                        children:
                          "A PASS is a token in your wallet. Whoever controls the wallet controls the PASS.",
                      }),
                      m.jsx("li", {
                        children:
                          "Genesis art is hosted on IPFS; Standard art is generated on-chain. Both are readable by any marketplace.",
                      }),
                      m.jsx("li", {
                        children:
                          "Mystery mints are random. A preview on this site is never a promise of rarity.",
                      }),
                      m.jsx("li", {
                        children:
                          "Burned BMC and IMD are gone permanently. Nobody can reverse a burn.",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "safety",
        children: [
          m.jsx(Ft, { title: "Wallet safety", id: "safety" }),
          m.jsx(yl, {
            title:
              "This site will never ask for your seed phrase or private key",
            tone: "danger",
            children: m.jsx("p", {
              children:
                "Anyone who asks for them is trying to steal from you. The site only requests a wallet connection, a network switch to Ethereum mainnet and, when a feature is live, a transaction you confirm in your own wallet.",
            }),
          }),
          m.jsxs("div", {
            className: "grid grid-3",
            children: [
              m.jsxs(fe, {
                compact: !0,
                children: [
                  m.jsx("h4", { children: "Approve only what you spend" }),
                  m.jsx("p", {
                    children:
                      "Set token approvals to the exact amount. Revoke old approvals you no longer use.",
                  }),
                ],
              }),
              m.jsxs(fe, {
                compact: !0,
                children: [
                  m.jsx("h4", { children: "Check the address" }),
                  m.jsx("p", {
                    children:
                      "Compare the BMC contract in your wallet with the one in the footer before any transaction.",
                  }),
                ],
              }),
              m.jsxs(fe, {
                compact: !0,
                children: [
                  m.jsx("h4", { children: "Stay on chain ID 1" }),
                  m.jsx("p", {
                    children:
                      "The site warns when your wallet is on another network. Do not bridge or send funds elsewhere.",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "faq",
        children: [
          m.jsx(Ft, { title: "Frequently asked questions", id: "faq" }),
          m.jsx("div", {
            className: "stack",
            children: lx.map((a) =>
              m.jsxs(
                "details",
                {
                  className: "faq",
                  children: [
                    m.jsx("summary", { children: a.q }),
                    m.jsx("div", { children: a.a }),
                  ],
                },
                a.q,
              ),
            ),
          }),
        ],
      }),
    ],
  });
}
function Yr() {
  const s = usePlatform();
  return {
    address: s.wallet.account,
    isLoading: s.loading,
    isError: !!s.publicError,
    name: "BMC Illuminati",
    symbol: "BMC",
    decimals: 18,
    totalSupply: s.public?.totalSupply,
    bmcBalance: s.wallet.balance ?? undefined,
    ethBalance: s.personal?.eth,
  };
}

const Vn = "Coming soon";
function sx() {
  const a = Yr(),
    l = a.isError
      ? "Unavailable"
      : a.isLoading
        ? "Loading…"
        : `${Na(a.totalSupply, a.decimals, 0)} BMC`;
  return m.jsxs(m.Fragment, {
    children: [
      h(PersonalDashboard),
      m.jsxs("section", {
        className: "section",
        children: [
          m.jsxs("div", {
            className: "section-head",
            children: [
              m.jsx("h2", {
                style: { fontSize: "var(--text-xl)" },
                children: "Ecosystem dashboard",
              }),
              m.jsx("p", {
                children:
                  "Every figure here is read from a verified contract or shown as “Coming soon”. Nothing is estimated or invented.",
              }),
            ],
          }),
          m.jsxs("div", {
            className: "grid grid-3",
            children: [
              m.jsxs(fe, {
                children: [
                  m.jsxs("h3", {
                    className: "heading-with-emblem",
                    children: [m.jsx(oi, { variant: "logo" }), "BMC token"],
                  }),
                  m.jsx(be, {
                    label: "Total supply (live)",
                    value: l,
                    tone: "cyber",
                  }),
                  m.jsx("p", {
                    className: "caption",
                    children: m.jsx(ic, { address: Gr }),
                  }),
                ],
              }),
              m.jsxs(fe, {
                tone: "mystic",
                children: [
                  m.jsx("h3", { children: "BMC PASS" }),
                  m.jsx(be, {
                    label: "BMC burned by minting",
                    value: P.snapshot().public
                      ? P.format(P.snapshot().public.burned) + " BMC"
                      : "Unavailable",
                  }),
                  m.jsx(be, {
                    label: "Supply and mint progress",
                    value: At("pass") ? "—" : "Read collection above",
                  }),
                  m.jsx(be, {
                    label: "Max burn at mint-out",
                    value: `${mt(Le.maxBurnBmc)} BMC`,
                    note: "Fixed by the mint schedule",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Staking" }),
                  m.jsx(be, {
                    label: "Total BMC staked",
                    value: At("tokenStaking") ? "—" : Vn,
                  }),
                  m.jsx(be, {
                    label: "Passes staked",
                    value: At("passStaking") ? "—" : Vn,
                  }),
                  m.jsx(be, {
                    label: "Funded rewards",
                    value: At("tokenStaking") ? "—" : Vn,
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "IMD burned by mechanism" }),
                  m.jsx(be, {
                    label: "Voluntary burns",
                    value: At("imdToken") ? "—" : Vn,
                  }),
                  m.jsx(be, {
                    label: "PASS customisation",
                    value: At("imdToken") ? "—" : Vn,
                  }),
                  m.jsx(be, {
                    label: "Community privileges",
                    value: At("imdToken") ? "—" : Vn,
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Manual IMD buybacks" }),
                  m.jsx(be, { label: "IMD purchased", value: Vn }),
                  m.jsx(be, { label: "IMD burned", value: Vn }),
                  m.jsx(be, { label: "History", value: "0 records" }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Integration status" }),
                  m.jsx("dl", {
                    className: "kv",
                    children: Object.keys(Xu).map((r) =>
                      m.jsxs(
                        "div",
                        {
                          children: [
                            m.jsx("dt", { children: Xu[r].label }),
                            m.jsx("dd", {
                              children: At(r)
                                ? m.jsx(Ma, {
                                    tone: "live",
                                    children: "Verified",
                                  })
                                : m.jsx(Ma, {
                                    tone: "soon",
                                    children: "Unset",
                                  }),
                            }),
                          ],
                        },
                        r,
                      ),
                    ),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "method",
        children: [
          m.jsx(Ft, { title: "How these numbers are produced", id: "method" }),
          m.jsx(yl, {
            title: "Sources",
            children: m.jsx("p", {
              children:
                "BMC supply is read from the token contract on Ethereum through your configured RPC. PASS, staking and IMD figures will be read from their contracts once the addresses in the site configuration are verified. Buyback history is recorded by the operator from confirmed transactions, each with an explorer link.",
            }),
          }),
        ],
      }),
    ],
  });
}
function ux() {
  const a = Yr();
  return m.jsxs(m.Fragment, {
    children: [
      m.jsxs("section", {
        className: "hero",
        "aria-labelledby": "hero-title",
        children: [
          m.jsxs("div", {
            className: "hero-copy",
            children: [
              m.jsx("h1", {
                id: "hero-title",
                className: "hero-title fade-up",
                children: "Enter BMC Illuminati",
              }),
              m.jsx("p", {
                className: "hero-slogan fade-up",
                children: jn.slogan,
              }),
              m.jsx("p", {
                className: "hero-sub fade-up",
                children: jn.subtitle,
              }),
              m.jsxs("div", {
                className: "hero-actions fade-up",
                children: [
                  m.jsx("a", {
                    href: "./mint/",
                    className: "btn btn-primary",
                    children: "Mint BMC Pass",
                  }),
                  m.jsx(En, {
                    to: "/swap",
                    className: "btn btn-secondary",
                    children: "Swap BMC",
                  }),
                  m.jsx(En, {
                    to: "/staking",
                    className: "btn btn-secondary",
                    children: "Explore staking",
                  }),
                ],
              }),
              m.jsxs("div", {
                className: "hero-trust",
                children: [
                  m.jsx(Ma, { tone: "live", children: nc }),
                  m.jsx(Ma, { children: "500 Passes · Fixed cap" }),
                  m.jsx(Ma, {
                    tone: "soon",
                    children: "Mint locked · Pre-launch",
                  }),
                ],
              }),
            ],
          }),
          h(
            "figure",
            { className: "hero-visual real-art" },
            h("img", {
              src: "./artwork/genesis/genesis-01.webp",
              alt: "Legendary Genesis artwork #1 from the immutable BMC collection",
              width: 480,
              height: 480,
              fetchPriority: "high",
            }),
            h(
              "figcaption",
              {},
              h("span", {}, "Genesis #01"),
              h("span", {}, "Legendary · IPFS artwork"),
            ),
          ),
        ],
      }),
      h(HomeStatus),
      m.jsxs("section", {
        className: "section ecosystem",
        "aria-labelledby": "how",
        children: [
          null,
          m.jsx(Ft, {
            title: "How the ecosystem works",
            id: "how",
            children: m.jsx("p", {
              children:
                "One Ethereum token. Collectibles, swaps, staking and community tools open only after their own launch checks.",
            }),
          }),
          m.jsxs("div", {
            className: "grid grid-4",
            children: [
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "BMC PASS" }),
                  m.jsxs("p", {
                    children: [
                      "A collection of exactly ",
                      Le.total,
                      " ERC-721 collectibles: ",
                      Le.genesis,
                      " Genesis and",
                      " ",
                      Le.standard,
                      " Standard. Every mint burns BMC forever.",
                    ],
                  }),
                  m.jsx(En, {
                    to: "/pass",
                    children: "Explore the PASS collection",
                  }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Swap BMC" }),
                  m.jsx("p", {
                    children:
                      "Buy or sell BMC with ETH through an established DEX once a verified liquidity route exists.",
                  }),
                  m.jsx(En, { to: "/swap", children: "Open the swap" }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "IMD Burn Center" }),
                  m.jsx("p", {
                    children:
                      "Burn IMD voluntarily, unlock profile customisation and community roles, and track manual buybacks.",
                  }),
                  m.jsx(En, { to: "/burns", children: "Open the burn center" }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Staking" }),
                  m.jsx("p", {
                    children:
                      "Explore the planned BMC and Pass staking programs. Deposits remain disabled: no reviewed Mainnet staking deployment is recorded.",
                  }),
                  m.jsx(En, {
                    to: "/staking",
                    children: "Explore staking options",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "wallet",
        children: [
          m.jsx(Ft, {
            title: "Connect your wallet",
            id: "wallet",
            children: m.jsx("p", {
              children:
                "Connection only shows your balances. The site never asks for a seed phrase, a private key or an unlimited approval.",
            }),
          }),
          m.jsxs("div", {
            className: "grid grid-2",
            children: [
              m.jsxs(fe, {
                children: [
                  m.jsx("h3", { children: "Wallet" }),
                  m.jsx(Zu, {}),
                  a.address
                    ? m.jsxs("div", {
                        className: "grid grid-2",
                        children: [
                          m.jsx(be, {
                            label: "ETH balance",
                            value: `${Na(a.ethBalance, 18, 4)} ETH`,
                          }),
                          m.jsx(be, {
                            label: "BMC balance",
                            value: `${Na(a.bmcBalance, a.decimals)} ${a.symbol}`,
                            tone: "accent",
                          }),
                        ],
                      })
                    : m.jsx("p", {
                        children:
                          "Connect a browser wallet such as MetaMask or Rabby to see your ETH and BMC balances.",
                      }),
                ],
              }),
              m.jsxs(fe, {
                children: [
                  m.jsxs("h3", {
                    className: "heading-with-emblem",
                    children: [m.jsx(oi, { variant: "logo" }), "BMC token"],
                  }),
                  m.jsx(be, {
                    label: "Total supply (live from Ethereum)",
                    value: a.isError
                      ? "Unavailable"
                      : a.isLoading
                        ? "Loading…"
                        : `${Na(a.totalSupply, a.decimals, 0)} BMC`,
                    tone: "cyber",
                    note: a.name ? `${a.name} (${a.symbol})` : void 0,
                  }),
                  m.jsxs("p", {
                    className: "caption",
                    children: ["Contract ", m.jsx(ic, { address: Gr })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "start",
        children: [
          m.jsx(Ft, { title: "Start here if you are new", id: "start" }),
          m.jsxs("ol", {
            className: "step-list",
            children: [
              m.jsx("li", {
                children: m.jsxs("div", {
                  children: [
                    m.jsx("strong", { children: "Get a wallet" }),
                    m.jsx("span", {
                      children:
                        "Install a browser wallet, write the recovery phrase down offline and never share it.",
                    }),
                  ],
                }),
              }),
              m.jsx("li", {
                children: m.jsxs("div", {
                  children: [
                    m.jsx("strong", {
                      children: "Hold some ETH on Ethereum mainnet",
                    }),
                    m.jsx("span", {
                      children:
                        "ETH pays network fees. The site checks that your wallet is on chain ID 1.",
                    }),
                  ],
                }),
              }),
              m.jsx("li", {
                children: m.jsxs("div", {
                  children: [
                    m.jsx("strong", { children: "Swap ETH for BMC" }),
                    m.jsx("span", {
                      children:
                        "Use the swap page once a verified route is live. Start with a small amount.",
                    }),
                  ],
                }),
              }),
              m.jsx("li", {
                children: m.jsxs("div", {
                  children: [
                    m.jsx("strong", { children: "Mint, stake or burn" }),
                    m.jsxs("span", {
                      children: [
                        "A PASS mint burns ",
                        mt(Le.earlyPriceBmc),
                        " or ",
                        mt(Le.mysteryPriceBmc),
                        " BMC. Each action opens only after its contract is verified.",
                      ],
                    }),
                  ],
                }),
              }),
            ],
          }),
          m.jsx(Qr, { integration: "pass" }),
        ],
      }),
    ],
  });
}
const cx = [
  { key: "all", label: "All 500" },
  { key: "legendary", label: "Legendary #1" },
  { key: "early", label: "Early Genesis" },
  { key: "mystery", label: "Mystery (pending reveal)" },
];
function ox(a) {
  return a === 1 ? "legendary" : a <= Le.earlyMints ? "early" : "mystery";
}
const fx = Array.from({ length: Le.total }, (a, l) => ({
    n: l + 1,
    tier: ox(l + 1),
  })),
  Mu = 48;
function dx({ slot: a }) {
  const l =
      a.tier === "legendary"
        ? "var(--color-legend)"
        : a.tier === "early"
          ? "var(--color-mystic-soft)"
          : "var(--color-cyber)",
    c = (((a.n * 9301 + 49297) % 233280) % 11) - 5;
  return m.jsxs("svg", {
    viewBox: "0 0 100 100",
    "aria-hidden": "true",
    children: [
      m.jsx("path", {
        d: `M50 14 L${78 + c} 70 H${22 - c} Z`,
        fill: "none",
        stroke: l,
        strokeWidth: "2.5",
        strokeLinejoin: "round",
      }),
      m.jsx("path", {
        d: "M32 82 Q50 60 68 82",
        fill: "none",
        stroke: l,
        strokeWidth: "2",
        opacity: "0.6",
      }),
      m.jsx("ellipse", {
        cx: "50",
        cy: "52",
        rx: "9",
        ry: "5",
        fill: "none",
        stroke: l,
        strokeWidth: "1.8",
      }),
      m.jsx("circle", { cx: "50", cy: "52", r: "2.6", fill: l }),
      a.tier === "mystery"
        ? m.jsx("text", {
            x: "50",
            y: "94",
            textAnchor: "middle",
            fontSize: "12",
            fill: l,
            fontFamily: "ui-monospace, monospace",
            children: "?",
          })
        : null,
    ],
  });
}
function hx() {
  const live = usePlatform();
  const [a, l] = ne.useState("all"),
    [r, c] = ne.useState(Mu),
    o = Yr(),
    d = At("pass"),
    minted = live.public?.minted,
    y = ne.useMemo(() => fx.filter((b) => a === "all" || b.tier === a), [a]);
  return m.jsxs(m.Fragment, {
    children: [
      h(CollectionSummary),
      h(ArtworkGallery),
      m.jsxs("section", {
        className: "section",
        children: [
          m.jsxs("div", {
            className: "section-head",
            children: [
              m.jsx("h2", {
                style: { fontSize: "var(--text-xl)" },
                children: "BMC PASS",
              }),
              m.jsxs("p", {
                children: [
                  "Collection design: ",
                  Le.total,
                  " ERC-721 collectibles: ",
                  Le.genesis,
                  " Genesis and ",
                  Le.standard,
                  " Standard. Minting remains gated after deployment until release approval.",
                ],
              }),
            ],
          }),
          m.jsx(lc, {}),
          m.jsxs("div", {
            className: "grid grid-4",
            children: [
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Minted",
                  value:
                    minted === undefined
                      ? "Unavailable / 500"
                      : `${mt(minted)} / 500`,
                  note: "Read-only IMD deployment",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Remaining supply",
                  value:
                    minted === undefined ? "Unavailable" : mt(500n - minted),
                  tone: "cyber",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Next mint burns",
                  value: live.public
                    ? P.format(live.public.price) + " BMC"
                    : "Unavailable",
                  tone: "accent",
                  note: "Genesis price · Fixed by contract",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "BMC burned by minting",
                  value: live.public
                    ? `${P.format(live.public.burned)} BMC`
                    : "Unavailable",
                  note: `Max ${mt(Le.maxBurnBmc)} at mint-out`,
                }),
              }),
            ],
          }),
          m.jsxs("div", {
            className: "stack",
            children: [
              m.jsx(Pw, {
                value: Number(minted ?? 0n),
                max: Le.total,
                label: "Mint progress",
              }),
              m.jsxs("span", {
                className: "caption",
                children: [
                  "Mint progress: ",
                  minted === undefined ? "unavailable" : String(minted),
                  " of ",
                  Le.total,
                  ". Read from the IMD deployment; minting remains locked.",
                ],
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "mint",
        children: [
          m.jsx(Ft, { title: "Mint", id: "mint" }),
          m.jsxs("div", {
            className: "grid grid-2",
            children: [
              m.jsxs(fe, {
                tone: "legend",
                children: [
                  m.jsx("h3", {
                    children: "Mints 1–40: guaranteed Genesis PASS",
                  }),
                  m.jsxs("p", {
                    children: [
                      "Price: ",
                      mt(Le.earlyPriceBmc),
                      " BMC burned per mint. The first successful buyer receives Legendary Genesis #1. Mints 2–40 receive Genesis #2–40.",
                    ],
                  }),
                ],
              }),
              m.jsxs(fe, {
                tone: "mystic",
                children: [
                  m.jsx("h3", { children: "Mints 41–500: Mystery PASS" }),
                  m.jsxs("p", {
                    children: [
                      "Price: ",
                      mt(Le.mysteryPriceBmc),
                      " BMC burned per mint. The verified contract randomly assigns",
                      " ",
                      Le.mysteryGenesis,
                      " Genesis and ",
                      Le.standard,
                      " Standard without replacement.",
                    ],
                  }),
                ],
              }),
            ],
          }),
          m.jsxs(fe, {
            children: [
              m.jsx("h3", { children: "Your mint" }),
              m.jsxs("div", {
                className: "grid grid-2",
                children: [
                  m.jsx(be, {
                    label: "Your BMC balance",
                    value: o.address
                      ? `${Na(o.bmcBalance, o.decimals)} BMC`
                      : "Connect wallet",
                  }),
                  m.jsx(be, {
                    label: "Your PASS balance",
                    value: d ? "—" : "Coming soon",
                    note: "Read from the verified contract",
                  }),
                  m.jsx(be, {
                    label: "Pending reveals",
                    value: d ? "—" : "Coming soon",
                  }),
                  m.jsx(be, {
                    label: "Mint price",
                    value: live.public
                      ? P.format(live.public.price) + " BMC"
                      : "Unavailable",
                    tone: "accent",
                  }),
                ],
              }),
              m.jsx("button", {
                type: "button",
                className: "btn btn-primary",
                disabled: !0,
                "aria-describedby": "mint-why",
                children: "Mint BMC Pass",
              }),
              m.jsx("span", {
                id: "mint-why",
                className: "field-help",
                children:
                  "Minting is disabled pending deployment reconciliation and independent release approval. Open the mint page for checks and wallet details.",
              }),
            ],
          }),
          d ? null : m.jsx(Qr, { integration: "pass" }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "legend",
        children: [
          m.jsx(Ft, {
            title: "Legendary Genesis #1",
            id: "legend",
            children: m.jsx("p", {
              children:
                "The first Genesis artwork. A proposed 5× staking weight is not an active entitlement; no staking contract has been verified.",
            }),
          }),
          m.jsx(fe, {
            tone: "legend",
            children: m.jsxs("div", {
              className: "legend-showcase",
              children: [
                m.jsx("div", {
                  className: "pass-art legend",
                  style: { width: "100%", maxWidth: "14rem" },
                  children: m.jsx(oi, {
                    variant: "logo",
                    animated: !0,
                    title: "Legendary Genesis #1 placeholder emblem",
                  }),
                }),
                m.jsxs("div", {
                  className: "stack",
                  children: [
                    m.jsx("h3", {
                      children: "Awarded to the first successful mint",
                    }),
                    m.jsx("p", {
                      children:
                        "Genesis artwork is a set of 77 original black-and-gold characters hosted at the immutable IPFS directory. The real artwork gallery above links to every original.",
                    }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "gallery",
        children: [
          m.jsx(Ft, {
            title: "Planned token slots",
            id: "gallery",
            children: m.jsxs("p", {
              children: [
                "Preview of all ",
                Le.total,
                " planned slots. The glyphs below illustrate allocation only; they are not minted NFTs. Real Genesis and Standard artwork previews are shown above.",
              ],
            }),
          }),
          m.jsx("div", {
            className: "segmented",
            role: "group",
            "aria-label": "Filter by rarity",
            children: cx.map((b) =>
              m.jsx(
                "button",
                {
                  type: "button",
                  "aria-pressed": a === b.key,
                  onClick: () => {
                    (l(b.key), c(Mu));
                  },
                  children: b.label,
                },
                b.key,
              ),
            ),
          }),
          m.jsxs("p", {
            className: "small muted",
            role: "status",
            children: [
              "Showing ",
              mt(Math.min(r, y.length)),
              " of ",
              mt(y.length),
              " slots",
            ],
          }),
          m.jsx("ul", {
            className: "gallery",
            style: { listStyle: "none", padding: 0 },
            children: y.slice(0, r).map((b) =>
              m.jsxs(
                "li",
                {
                  className: "pass-card",
                  style: { margin: 0 },
                  children: [
                    m.jsx("div", {
                      className: `pass-art ${b.tier === "legendary" ? "legend" : b.tier === "early" ? "genesis" : ""}`,
                      children: m.jsx(dx, { slot: b }),
                    }),
                    m.jsxs("div", {
                      className: "pass-meta",
                      children: [
                        m.jsxs("strong", { children: ["#", b.n] }),
                        b.tier === "legendary"
                          ? m.jsx(Ma, {
                              tone: "legend",
                              children: "Legendary",
                            })
                          : b.tier === "early"
                            ? m.jsx(Ma, {
                                tone: "mystic",
                                children: "Genesis",
                              })
                            : m.jsx(Ma, { children: "Mystery" }),
                      ],
                    }),
                  ],
                },
                b.n,
              ),
            ),
          }),
          r < y.length
            ? m.jsxs("button", {
                type: "button",
                className: "btn btn-secondary",
                onClick: () => c((b) => b + Mu),
                children: ["Show ", mt(Math.min(Mu, y.length - r)), " more"],
              })
            : null,
          m.jsx(yl, {
            title: "Rarity odds for mystery mints",
            children: m.jsx("p", {
              children:
                "460 mystery mints share 37 Genesis and 423 Standard PASSes, drawn without replacement by the contract. No preview here is a promise of rarity.",
            }),
          }),
        ],
      }),
    ],
  });
}
function fd({ integration: a, title: l, children: r, tone: c }) {
  const o = At(a);
  return m.jsxs(fe, {
    tone: c,
    children: [
      m.jsx("h3", { children: l }),
      r,
      m.jsxs("div", {
        className: "grid grid-2",
        children: [
          m.jsx(be, { label: "Staked", value: o ? "—" : "Coming soon" }),
          m.jsx(be, {
            label: "Claimable rewards",
            value: o ? "—" : "Coming soon",
          }),
          m.jsx(be, { label: "Pool funding", value: o ? "—" : "Coming soon" }),
          m.jsx(be, { label: "Program ends", value: o ? "—" : "Coming soon" }),
        ],
      }),
      m.jsxs("div", {
        className: "row",
        children: [
          m.jsx("button", {
            type: "button",
            className: "btn btn-primary btn-sm",
            disabled: !o,
            children: "Stake",
          }),
          m.jsx("button", {
            type: "button",
            className: "btn btn-secondary btn-sm",
            disabled: !o,
            children: "Claim rewards",
          }),
          m.jsx("button", {
            type: "button",
            className: "btn btn-secondary btn-sm",
            disabled: !o,
            children: "Withdraw",
          }),
        ],
      }),
    ],
  });
}
function mx() {
  return h(
    ne.Fragment,
    {},
    h(StakingPage),
    h(
      "details",
      { className: "legacy-proposal" },
      h("summary", {}, "View the original staking proposal"),
      h(StakingProposal),
    ),
  );
}
function StakingProposal() {
  const a = Yr();
  return m.jsxs(m.Fragment, {
    children: [
      m.jsxs("section", {
        className: "section",
        children: [
          m.jsxs("div", {
            className: "section-head",
            children: [
              m.jsxs("h2", {
                className: "heading-with-emblem",
                style: { fontSize: "var(--text-xl)" },
                children: [m.jsx(oi, { variant: "logo" }), "Staking"],
              }),
              m.jsx("p", {
                children:
                  "Historical proposal only. Weights, allocations and duration below are not verified on-chain terms and grant no reward rights.",
              }),
            ],
          }),
          m.jsx(lc, {}),
          m.jsxs("div", {
            className: "grid grid-2",
            children: [
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Your BMC balance",
                  value: a.address
                    ? `${Na(a.bmcBalance, a.decimals)} BMC`
                    : "Connect wallet",
                  tone: "accent",
                }),
              }),
              m.jsx(fe, {
                compact: !0,
                children: m.jsx(be, {
                  label: "Your PASS balance",
                  value: "Coming soon",
                  note: "Read from the verified PASS contract",
                }),
              }),
            ],
          }),
          At("tokenStaking")
            ? null
            : m.jsx(Qr, { integration: "tokenStaking" }),
          m.jsxs("div", {
            className: "grid grid-3",
            children: [
              m.jsx(fd, {
                integration: "tokenStaking",
                title: "1 · BMC token staking",
                children: m.jsx("p", {
                  children:
                    "Stake BMC and earn BMC rewards from a funded pool. Withdraw any time the contract allows.",
                }),
              }),
              m.jsx(fd, {
                integration: "passStaking",
                title: "2 · BMC PASS staking",
                tone: "mystic",
                children: m.jsx("p", {
                  children:
                    "Stake eligible passes. Each PASS earns by its reward weight: Standard 1×, up to Legendary Genesis #1 at 5×.",
                }),
              }),
              m.jsx(fd, {
                integration: "combinedStaking",
                title: "3 · Combined staking",
                tone: "legend",
                children: m.jsx("p", {
                  children:
                    "Stake BMC and at least one PASS for up to 20% additional reward weight, limited by a funded bonus pool.",
                }),
              }),
            ],
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "weights",
        children: [
          m.jsx(Ft, { title: "Proposed Pass reward weights", id: "weights" }),
          m.jsx("div", {
            className: "table-wrap",
            role: "region",
            "aria-labelledby": "weights",
            tabIndex: 0,
            children: m.jsxs("table", {
              children: [
                m.jsx("thead", {
                  children: m.jsxs("tr", {
                    children: [
                      m.jsx("th", { scope: "col", children: "Tier" }),
                      m.jsx("th", { scope: "col", children: "Weight" }),
                      m.jsx("th", { scope: "col", children: "Passes" }),
                      m.jsx("th", {
                        scope: "col",
                        children: "How it is assigned",
                      }),
                    ],
                  }),
                }),
                m.jsx("tbody", {
                  children: Xw.map((l) =>
                    m.jsxs(
                      "tr",
                      {
                        children: [
                          m.jsx("th", {
                            scope: "row",
                            style: {
                              background: "none",
                              fontSize: "var(--text-sm)",
                              color: "var(--color-text)",
                            },
                            children: l.tier,
                          }),
                          m.jsx("td", { className: "num", children: l.weight }),
                          m.jsx("td", { className: "num", children: l.count }),
                          m.jsx("td", {
                            style: { whiteSpace: "normal" },
                            children: l.note,
                          }),
                        ],
                      },
                      l.tier,
                    ),
                  ),
                }),
              ],
            }),
          }),
        ],
      }),
      m.jsxs("section", {
        className: "section",
        "aria-labelledby": "allocation",
        children: [
          m.jsx(Ft, {
            title: "Proposed reward allocation",
            id: "allocation",
            children: m.jsx("p", {
              children:
                "Suggested program duration: 12 months. The final split is set when the pools are funded.",
            }),
          }),
          m.jsx("div", {
            className: "grid grid-4",
            children: Vw.map((l) =>
              m.jsx(
                fe,
                {
                  compact: !0,
                  children: m.jsx(be, {
                    label: l.label,
                    value: `${l.pct}%`,
                    tone: l.label === "Reserve" ? void 0 : "cyber",
                  }),
                },
                l.label,
              ),
            ),
          }),
          m.jsx(yl, {
            title: "No guaranteed yield",
            tone: "warn",
            children: m.jsx("p", {
              children:
                "Rewards are paid only from BMC the operator deposits into each pool. If a pool is not funded, staking opens nothing and pays nothing. No new BMC is issued and no APY is guaranteed. Check the funded amount shown on each card before staking.",
            }),
          }),
        ],
      }),
    ],
  });
}
const yx = ["0.5", "1", "3"];
function bx() {
  const [a, l] = ne.useState("buy"),
    [r, c] = ne.useState(""),
    [o, d] = ne.useState("1"),
    h = Yr(),
    y = At("swapRoute"),
    b = Number(r),
    g = r !== "" && (!Number.isFinite(b) || b <= 0),
    S = a === "buy" ? "ETH" : "BMC",
    v = a === "buy" ? "BMC" : "ETH";
  return m.jsx(m.Fragment, {
    children: m.jsxs("section", {
      className: "section",
      children: [
        m.jsxs("div", {
          className: "section-head",
          children: [
            m.jsx("h1", {
              style: { fontSize: "var(--text-xl)" },
              children: "Swap BMC",
            }),
            m.jsx("p", {
              children:
                "Trade ETH and BMC through an established Ethereum DEX once a verified liquidity route exists.",
            }),
          ],
        }),
        m.jsx(lc, {}),
        m.jsxs("div", {
          className: "grid grid-2",
          children: [
            m.jsxs(fe, {
              children: [
                m.jsxs("div", {
                  className: "row between",
                  children: [
                    m.jsx("h3", { children: "Swap" }),
                    m.jsxs("div", {
                      className: "segmented",
                      role: "group",
                      "aria-label": "Direction",
                      children: [
                        m.jsx("button", {
                          type: "button",
                          "aria-pressed": a === "buy",
                          onClick: () => l("buy"),
                          children: "Buy BMC",
                        }),
                        m.jsx("button", {
                          type: "button",
                          "aria-pressed": a === "sell",
                          onClick: () => l("sell"),
                          children: "Sell BMC",
                        }),
                      ],
                    }),
                  ],
                }),
                m.jsxs("div", {
                  className: "field",
                  children: [
                    m.jsx("label", {
                      htmlFor: "swap-amount",
                      children: "You pay",
                    }),
                    m.jsxs("div", {
                      className: "input-group",
                      children: [
                        m.jsx("input", {
                          id: "swap-amount",
                          inputMode: "decimal",
                          autoComplete: "off",
                          placeholder: "0.0",
                          value: r,
                          onChange: (w) => c(w.target.value.replace(",", ".")),
                          "aria-invalid": g || void 0,
                          "aria-describedby": g
                            ? "swap-amount-error"
                            : "swap-amount-help",
                        }),
                        m.jsx("span", { className: "token-chip", children: S }),
                      ],
                    }),
                    g
                      ? m.jsx("span", {
                          id: "swap-amount-error",
                          className: "field-error",
                          children:
                            "Enter an amount greater than zero, using digits and one decimal point.",
                        })
                      : m.jsxs("span", {
                          id: "swap-amount-help",
                          className: "field-help",
                          children: [
                            "Balance:",
                            " ",
                            h.address
                              ? a === "buy"
                                ? `${Na(h.ethBalance, 18, 4)} ETH`
                                : `${Na(h.bmcBalance, h.decimals)} BMC`
                              : "connect a wallet",
                          ],
                        }),
                  ],
                }),
                m.jsxs("div", {
                  className: "field",
                  children: [
                    m.jsx("span", {
                      className: "field-help",
                      id: "swap-receive-label",
                      children: "You receive",
                    }),
                    m.jsxs("div", {
                      className: "input-group",
                      "aria-labelledby": "swap-receive-label",
                      children: [
                        m.jsx("input", {
                          readOnly: !0,
                          value: y ? "" : "—",
                          "aria-label": `Estimated ${v} received`,
                        }),
                        m.jsx("span", { className: "token-chip", children: v }),
                      ],
                    }),
                  ],
                }),
                m.jsxs("div", {
                  className: "field",
                  children: [
                    m.jsx("span", {
                      className: "field-help",
                      id: "slippage-label",
                      children: "Slippage tolerance",
                    }),
                    m.jsx("div", {
                      className: "segmented",
                      role: "group",
                      "aria-labelledby": "slippage-label",
                      children: yx.map((w) =>
                        m.jsxs(
                          "button",
                          {
                            type: "button",
                            "aria-pressed": o === w,
                            onClick: () => d(w),
                            children: [w, "%"],
                          },
                          w,
                        ),
                      ),
                    }),
                  ],
                }),
                m.jsxs("dl", {
                  className: "kv",
                  children: [
                    m.jsxs("div", {
                      children: [
                        m.jsx("dt", { children: "Live quote" }),
                        m.jsx("dd", { children: y ? "—" : "Coming soon" }),
                      ],
                    }),
                    m.jsxs("div", {
                      children: [
                        m.jsx("dt", { children: "Price impact" }),
                        m.jsx("dd", { children: y ? "—" : "Coming soon" }),
                      ],
                    }),
                    m.jsxs("div", {
                      children: [
                        m.jsx("dt", { children: "Network fee" }),
                        m.jsx("dd", { children: y ? "—" : "Coming soon" }),
                      ],
                    }),
                    m.jsxs("div", {
                      children: [
                        m.jsx("dt", { children: "Max slippage" }),
                        m.jsxs("dd", { children: [o, "%"] }),
                      ],
                    }),
                  ],
                }),
                h.address
                  ? m.jsxs("button", {
                      type: "button",
                      className: "btn btn-primary btn-block",
                      disabled: !y,
                      "aria-describedby": "swap-why",
                      children: ["Swap ", S, " for ", v],
                    })
                  : m.jsx(Zu, {}),
                m.jsx("span", {
                  id: "swap-why",
                  className: "field-help",
                  children: y
                    ? "You will confirm the exact amounts in your wallet."
                    : "Swaps are disabled: no verified liquidity route.",
                }),
                m.jsx("p", {
                  className: "caption",
                  role: "status",
                  children: "Transaction status: no transaction started.",
                }),
              ],
            }),
            m.jsxs("div", {
              className: "stack",
              children: [
                m.jsx(Qr, {
                  integration: "swapRoute",
                  extra: m.jsx("p", {
                    className: "caption",
                    children:
                      "Checked on 2026-10-12 at Ethereum block 26,173,322: Uniswap V2 factory has no BMC/WETH pair and the Uniswap V3 factory has no BMC/WETH pool at the 0.01%, 0.05%, 0.3% or 1% fee tiers. Other venues were not checked.",
                  }),
                }),
                m.jsxs(fe, {
                  children: [
                    m.jsx("h3", { children: "Before you swap" }),
                    m.jsxs("ul", {
                      className: "small muted",
                      children: [
                        m.jsx("li", {
                          children:
                            "Only trade on Ethereum mainnet (chain ID 1). The site warns when your wallet is elsewhere.",
                        }),
                        m.jsx("li", {
                          children:
                            "Approve only the amount you are selling. Never grant an unlimited approval.",
                        }),
                        m.jsx("li", {
                          children:
                            "Start small. Price impact rises quickly in thin pools.",
                        }),
                        m.jsx("li", {
                          children:
                            "Check the BMC contract address in your wallet before confirming.",
                        }),
                      ],
                    }),
                  ],
                }),
                m.jsx(fe, {
                  compact: !0,
                  children: m.jsx(be, {
                    label: "Route",
                    value: "Unset",
                    note: "Configured in src/config/contracts.ts",
                  }),
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
const px = {
  "/": ux,
  "/pass": hx,
  "/swap": bx,
  "/staking": mx,
  "/burns": ax,
  "/dashboard": sx,
  "/community": rx,
};
function gx() {
  ne.useEffect(() => {
    const replay = () => r(true);
    window.addEventListener("bmc:replay-intro", replay);
    return () => window.removeEventListener("bmc:replay-intro", replay);
  }, []);
  const a = Kw(),
    [l, r] = ne.useState(false),
    c = px[a];
  const previousRoute = ne.useRef(a);
  return (
    ne.useEffect(() => {
      const o = ac.find((h) => h.path === a)?.label ?? "Home";
      ((document.title =
        a === "/"
          ? "BMC Illuminati — Know • Create • Burn • Rise"
          : `${o} — BMC Illuminati`),
        window.scrollTo({ top: 0 }),
        previousRoute.current !== a &&
          document.getElementById("main")?.focus({ preventScroll: !0 }));
      previousRoute.current = a;
    }, [a]),
    m.jsxs(m.Fragment, {
      children: [
        m.jsx("a", {
          href: "#main",
          className: "skip-link",
          onClick: (o) => {
            (o.preventDefault(),
              document.getElementById("main")?.focus(),
              document.getElementById("main")?.scrollIntoView());
          },
          children: "Skip to content",
        }),
        m.jsxs("div", {
          className: "bg-layer",
          "aria-hidden": "true",
          children: [
            m.jsx("div", { className: "bg-grid" }),
            m.jsx("div", { className: "bg-glow green" }),
            m.jsx("div", { className: "bg-glow purple" }),
            null,
          ],
        }),
        l ? m.jsx(tx, { onDone: () => r(!1) }) : null,
        m.jsxs("div", {
          inert: l ? !0 : void 0,
          children: [
            m.jsx(Ww, { route: a }),
            m.jsx("main", {
              id: "main",
              tabIndex: -1,
              className: "container page",
              style: { outline: "none" },
              children: m.jsx(c, {}),
            }),
            m.jsx(kw, {}),
          ],
        }),
      ],
    })
  );
}
m6.createRoot(document.getElementById("root")).render(
  m.jsx(ne.StrictMode, { children: m.jsx(gx, {}) }),
);
