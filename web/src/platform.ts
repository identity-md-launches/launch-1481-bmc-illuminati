/** Shared, read-only chain service. Wallet writes remain exclusively inside MintClient's launch gate. */
type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
};
type Build = {
  abi: any[];
  selectors: Record<string, string>;
  abiSha256: string;
};
type Snapshot = {
  account: string | null;
  chainId: string | null;
  balance: bigint | null;
  allowance: bigint | null;
  stats: any;
  ready: boolean;
  busy: boolean;
  message: string;
  pending: any;
  minted: any;
};
type State = {
  wallet: Snapshot;
  loading: boolean;
  connecting: boolean;
  publicError: string;
  public: any;
  personal: { eth: bigint; passes: bigint } | null;
  providers: { name: string; provider: Provider }[];
};
declare global {
  interface Window {
    BMC_PASS_CONFIG: any;
    BMC_PASS_BUILD: Build;
    BMC_TOKEN_BUILD: Build;
    BMCMint: any;
    BMCPlatform: any;
    ethereum?: Provider & { providers?: Provider[]; isMetaMask?: boolean };
  }
}
const C = window.BMC_PASS_CONFIG;
const API = window.BMCMint;
const emptyWallet: Snapshot = {
  account: null,
  chainId: null,
  balance: null,
  allowance: null,
  stats: null,
  ready: false,
  busy: false,
  message: "",
  pending: null,
  minted: null,
};
let state: State = {
  wallet: emptyWallet,
  loading: true,
  connecting: false,
  publicError: "",
  public: null,
  personal: null,
  providers: [],
};
const subscribers = new Set<() => void>();
const publish = (change: Partial<State>) => {
  state = { ...state, ...change };
  subscribers.forEach((fn) => fn());
};
let storage: Storage | undefined;
try {
  storage = localStorage;
} catch {
  /* In-memory safety remains available. */
}
const client = new API.MintClient(
  C,
  window.BMC_PASS_BUILD,
  window.BMC_TOKEN_BUILD,
  {
    storage,
    onChange: (wallet: Snapshot) => {
      const previous = state.wallet;
      publish({
        wallet: { ...wallet },
        ...(previous.account !== wallet.account ||
        previous.chainId !== wallet.chainId
          ? { personal: null }
          : {}),
      });
    },
  },
);
let requestId = 0;
async function rpcAt(
  endpoint: string,
  method: string,
  params: unknown[] = [],
): Promise<any> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(10000),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error("Ethereum read service is unavailable. Retry in a moment.");
  const result = await response.json();
  if (result.error || !Object.hasOwn(result, "result"))
    throw new Error(
      "Ethereum could not answer this request. Retry or check Etherscan.",
    );
  return result.result;
}
const hex = (value: unknown): string => {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value))
    throw new Error("Invalid Ethereum response.");
  return value;
};
const read = (
  provider: Provider,
  address: string,
  build: Build,
  signature: string,
  args: unknown[] = [],
  block = "latest",
) =>
  provider.request({
    method: "eth_call",
    params: [
      { to: address, data: API.calldata(build, signature, args) },
      block,
    ],
  });
let endpoint: string | null = null;
async function publicProvider(): Promise<Provider> {
  for (const url of endpoint
    ? [endpoint, ...C.RPC_URLS.filter((u: string) => u !== endpoint)]
    : C.RPC_URLS) {
    try {
      if ((await rpcAt(url, "eth_chainId")) !== "0x1")
        throw new Error("Unexpected network.");
      endpoint = url;
      return {
        request: ({ method, params = [] }) => rpcAt(url, method, params),
      };
    } catch {
      endpoint = null;
    }
  }
  throw new Error(
    "Ethereum data is unavailable. Retry; no cached figures are shown as live.",
  );
}
let refreshId = 0;
async function refreshPublic(): Promise<void> {
  const id = ++refreshId;
  publish({ loading: true, publicError: "", public: null });
  try {
    const p = await publicProvider();
    const block = hex(await p.request({ method: "eth_blockNumber" }));
    const [nftCode, bmcCode] = await Promise.all([
      p.request({ method: "eth_getCode", params: [C.PASS_ADDRESS, block] }),
      p.request({ method: "eth_getCode", params: [C.BMC_ADDRESS, block] }),
    ]);
    const [nftHash, bmcHash] = await Promise.all([
      API.sha256Hex(nftCode),
      API.sha256Hex(bmcCode),
    ]);
    if (nftHash !== C.READ_RUNTIME_SHA256 || bmcHash !== C.BMC_RUNTIME_SHA256)
      throw new Error(
        "Contract bytecode changed. Data is withheld until it is reviewed.",
      );
    const sigs = [
      "totalMinted()",
      "remainingSupply()",
      "totalBurned()",
      "currentPrice()",
      "remainingMysteryGenesis()",
      "remainingMysteryStandard()",
      "pendingReveals()",
      "mintingOpen()",
    ];
    const [raw, totalSupply, decimals] = await Promise.all([
      Promise.all(
        sigs.map((sig) =>
          read(p, C.PASS_ADDRESS, window.BMC_PASS_BUILD, sig, [], block),
        ),
      ),
      read(
        p,
        C.BMC_ADDRESS,
        window.BMC_TOKEN_BUILD,
        "totalSupply()",
        [],
        block,
      ),
      read(p, C.BMC_ADDRESS, window.BMC_TOKEN_BUILD, "decimals()", [], block),
    ]);
    const [minted, remaining, burned, price, genesis, standard, pending, open] =
      raw.map((r: unknown): bigint => API.uint(r));
    const mysterySold = minted > 40n ? minted - 40n : 0n;
    if (
      API.uint(decimals) !== 18n ||
      minted > 500n ||
      remaining !== 500n - minted ||
      open > 1n ||
      burned !==
        (minted < 40n ? minted : 40n) * API.GENESIS +
          mysterySold * API.MYSTERY ||
      price !==
        (minted >= 500n ? 0n : minted < 40n ? API.GENESIS : API.MYSTERY) ||
      genesis > 37n ||
      standard > 423n ||
      pending > mysterySold ||
      genesis + standard !== 460n - (mysterySold - pending)
    )
      throw new Error(
        "Contract data is inconsistent. Refresh before continuing.",
      );
    if (id === refreshId)
      publish({
        public: {
          minted,
          remaining,
          burned,
          price,
          genesis,
          standard,
          pending,
          open: open === 1n,
          totalSupply: API.uint(totalSupply),
          block,
          readAt: Date.now(),
        },
        loading: false,
      });
  } catch (e) {
    if (id === refreshId)
      publish({
        public: null,
        loading: false,
        publicError: API.friendlyError(e),
      });
  }
}
let personalId = 0;
async function refreshPersonal(): Promise<void> {
  const id = ++personalId;
  publish({ personal: null });
  if (!client.state.account || client.state.chainId !== "0x1") return;
  const session = client.session();
  try {
    await client.assertSession(session);
    const block = await session.provider.request({ method: "eth_blockNumber" });
    const code = await session.provider.request({
      method: "eth_getCode",
      params: [C.PASS_ADDRESS, block],
    });
    if ((await API.sha256Hex(code)) !== C.READ_RUNTIME_SHA256)
      throw new Error("NFT bytecode differs from the recorded deployment.");
    const [eth, passes] = await Promise.all([
      session.provider.request({
        method: "eth_getBalance",
        params: [session.account, block],
      }),
      read(
        session.provider,
        C.PASS_ADDRESS,
        window.BMC_PASS_BUILD,
        "balanceOf(address)",
        [session.account],
        block,
      ),
    ]);
    await client.assertSession(session);
    if (id === personalId)
      publish({
        personal: { eth: BigInt(hex(eth)), passes: API.uint(passes) },
      });
  } catch (e) {
    if (id === personalId) client.emit(API.friendlyError(e));
  }
}
let accountRefresh: ReturnType<typeof setTimeout> | undefined;
subscribers.add(() => {
  const key = state.wallet.account + ":" + state.wallet.chainId;
  if (key !== lastPersonalKey) {
    lastPersonalKey = key;
    clearTimeout(accountRefresh);
    accountRefresh = setTimeout(() => void refreshPersonal(), 0);
  }
});
let lastPersonalKey = "";
function addProvider(provider: Provider | undefined, name = "Injected wallet") {
  if (
    !provider ||
    typeof provider.request !== "function" ||
    state.providers.some((p) => p.provider === provider)
  )
    return;
  publish({
    providers: [
      ...state.providers,
      { provider, name: String(name).slice(0, 80) },
    ],
  });
}
window.addEventListener("eip6963:announceProvider", (event: Event) => {
  const detail = (event as CustomEvent).detail;
  addProvider(detail?.provider, detail?.info?.name);
});
if (window.ethereum?.providers)
  window.ethereum.providers.forEach((p) => addProvider(p));
else
  addProvider(
    window.ethereum,
    window.ethereum?.isMetaMask ? "MetaMask" : "Injected wallet",
  );
window.dispatchEvent(new Event("eip6963:requestProvider"));
async function connect(index = 0) {
  if (state.connecting) return;
  publish({ connecting: true });
  try {
    await client.connect(state.providers[index]?.provider || window.ethereum);
  } catch (e) {
    client.emit(API.friendlyError(e));
  } finally {
    publish({ connecting: false });
  }
}
async function switchNetwork() {
  try {
    await client.switchNetwork();
  } catch (e) {
    client.emit(API.friendlyError(e));
  }
}
function format(
  value: bigint | null | undefined,
  decimals = 18,
  precision = 4,
): string {
  if (value === null || value === undefined) return "Unavailable";
  const unit = 10n ** BigInt(decimals),
    whole = value / unit,
    fraction = (value % unit)
      .toString()
      .padStart(decimals, "0")
      .slice(0, precision)
      .replace(/0+$/, "");
  return whole.toLocaleString("en-US") + (fraction ? "." + fraction : "");
}
/** Read-only owner enumeration, bounded by the contract's hard 500-token cap. Never an indexer. */
async function ownedTokens(): Promise<bigint[]> {
  const session = client.session();
  await client.assertSession(session);
  const result: bigint[] = [];
  const block = await session.provider.request({ method: "eth_blockNumber" });
  const code = await session.provider.request({
    method: "eth_getCode",
    params: [C.PASS_ADDRESS, block],
  });
  if ((await API.sha256Hex(code)) !== C.READ_RUNTIME_SHA256)
    throw new Error("NFT bytecode verification failed.");
  const minted = API.uint(
    await read(
      session.provider,
      C.PASS_ADDRESS,
      window.BMC_PASS_BUILD,
      "totalMinted()",
      [],
      block,
    ),
  );
  if (minted > 500n) throw new Error("Unexpected collection size.");
  for (let start = 1; start <= Number(minted); start += 8) {
    await client.assertSession(session);
    const ids = Array.from(
      { length: Math.min(8, Number(minted) - start + 1) },
      (_, i) => BigInt(start + i),
    );
    const owners = await Promise.all(
      ids.map((id) =>
        read(
          session.provider,
          C.PASS_ADDRESS,
          window.BMC_PASS_BUILD,
          "ownerOf(uint256)",
          [id],
          block,
        ),
      ),
    );
    owners.forEach((owner, i) => {
      if (API.uint(owner) === BigInt(session.account)) result.push(ids[i]);
    });
  }
  await client.assertSession(session);
  return result;
}
async function lookup(id: string | number | bigint) {
  if (!/^[1-9][0-9]{0,2}$/.test(String(id)) || BigInt(id) > 500n)
    throw new Error("Enter a token ID from 1 to 500.");
  const p = await publicProvider();
  const code = await p.request({
    method: "eth_getCode",
    params: [C.PASS_ADDRESS, "latest"],
  });
  if ((await API.sha256Hex(code)) !== C.READ_RUNTIME_SHA256)
    throw new Error("NFT bytecode verification failed.");
  const count = API.uint(
    await read(p, C.PASS_ADDRESS, window.BMC_PASS_BUILD, "totalMinted()"),
  );
  if (BigInt(id) > count)
    throw new Error(
      "This pass has not been minted yet. Browse the artwork gallery below.",
    );
  const raw = API.decodeString(
    await read(p, C.PASS_ADDRESS, window.BMC_PASS_BUILD, "tokenURI(uint256)", [
      BigInt(id),
    ]),
  );
  return API.decodeMetadata(raw, C.IPFS_GATEWAY);
}
window.BMCPlatform = {
  client,
  subscribe: (fn: () => void) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  snapshot: () => state,
  connect,
  disconnect: () => client.disconnect(),
  switchNetwork,
  refreshPublic,
  refreshPersonal,
  format,
  ownedTokens,
  lookup,
};
void refreshPublic();
setInterval(() => {
  if (!document.hidden) {
    void refreshPublic();
    if (client.state.account && !client.state.busy) {
      void client.refresh();
      void refreshPersonal();
    }
  }
}, 60000);
export {};
