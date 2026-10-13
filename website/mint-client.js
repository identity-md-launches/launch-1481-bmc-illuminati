/* EIP-1193 client. No dependencies, private keys, signatures, or automatic transactions. */
(function (root) {
  "use strict";
  const BMC = "0x38224239f2bdae357d47cb864bc533d7f72df961";
  const CID = "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u";
  const UNIT = 10n ** 18n;
  const GENESIS = 1000000n * UNIT,
    MYSTERY = 350000n * UNIT;
  const ZERO = "0x" + "0".repeat(40);
  const TRANSFER =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const isAddress = (a) =>
    typeof a === "string" &&
    /^0x[0-9a-f]{40}$/i.test(a) &&
    a.toLowerCase() !== ZERO;
  const isHash = (a) => typeof a === "string" && /^0x[0-9a-f]{64}$/i.test(a);
  const same = (a, b) =>
    typeof a === "string" &&
    typeof b === "string" &&
    a.toLowerCase() === b.toLowerCase();
  function uint(hex) {
    if (typeof hex !== "string" || !/^0x[0-9a-f]{64}$/i.test(hex))
      throw new Error("Invalid contract response.");
    return BigInt(hex);
  }
  function decodeString(hex) {
    if (
      typeof hex !== "string" ||
      !/^0x[0-9a-f]+$/i.test(hex) ||
      hex.length % 2
    )
      throw new Error("Invalid metadata response.");
    const offset = Number(BigInt("0x" + hex.slice(2, 66))) * 2 + 2;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 66 ||
      offset + 64 > hex.length
    )
      throw new Error("Invalid string offset.");
    const length = Number(BigInt("0x" + hex.slice(offset, offset + 64)));
    if (
      !Number.isSafeInteger(length) ||
      length > 100000 ||
      offset + 64 + length * 2 > hex.length
    )
      throw new Error("Invalid string length.");
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(
        hex.slice(offset + 64, offset + 64 + length * 2).match(/../g) || [],
        (x) => parseInt(x, 16),
      ),
    );
  }
  function encode(type, value) {
    if (type === "address") {
      if (!isAddress(value))
        throw new Error("A valid contract/account address is required.");
      return value.slice(2).toLowerCase().padStart(64, "0");
    }
    if (/^uint(8|16|32|64|128|256)?$/.test(type)) {
      const n = BigInt(value),
        bits = BigInt(type.slice(4) || "256");
      if (n < 0n || n >= 1n << bits)
        throw new Error("Integer outside ABI range.");
      return n.toString(16).padStart(64, "0");
    }
    if (type === "bytes4" && /^0x[0-9a-f]{8}$/i.test(value))
      return value.slice(2).padEnd(64, "0");
    throw new Error("Unsupported ABI argument.");
  }
  function calldata(build, signature, args = []) {
    const item = build.abi.find(
      (x) =>
        x.type === "function" &&
        `${x.name}(${x.inputs.map((i) => i.type).join(",")})` === signature,
    );
    const selector = build.selectors[signature];
    if (
      !item ||
      !/^[0-9a-f]{8}$/.test(selector) ||
      item.inputs.length !== args.length
    )
      throw new Error("Confirmed ABI does not support this call.");
    return (
      "0x" +
      selector +
      item.inputs.map((x, i) => encode(x.type, args[i])).join("")
    );
  }
  async function sha256Hex(hex) {
    if (!/^0x(?:[0-9a-f]{2})+$/i.test(hex))
      throw new Error("No deployed NFT contract code found.");
    const bytes = Uint8Array.from(hex.slice(2).match(/../g), (x) =>
      parseInt(x, 16),
    );
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  function decodeMetadata(uri, gateway) {
    const prefix = "data:application/json;base64,";
    if (!uri.startsWith(prefix))
      throw new Error("Unexpected token metadata format.");
    if (uri.length > 200000) throw new Error("Metadata is too large.");
    const metadata = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(root.atob(uri.slice(prefix.length)), (x) =>
          x.charCodeAt(0),
        ),
      ),
    );
    if (typeof metadata.name !== "string" || typeof metadata.image !== "string")
      throw new Error("Missing NFT metadata.");
    if (
      metadata.image.startsWith(`ipfs://${CID}/`) &&
      /^genesis-(?:0[1-9]|[1-6][0-9]|7[0-7])\.png$/.test(
        metadata.image.slice(`ipfs://${CID}/`.length),
      )
    ) {
      metadata.image = gateway + metadata.image.slice(7);
    } else if (
      !/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/.test(metadata.image)
    ) {
      throw new Error("Unexpected artwork URI. No substitute image is shown.");
    }
    return metadata;
  }
  function configuredLive(c, build) {
    const l = c.LAUNCH || {};
    return (
      c.MODE === "LIVE" &&
      c.DEPLOYMENT_CONFLICT !== true &&
      c.CHAIN_ID === 1 &&
      same(c.BMC_ADDRESS, BMC) &&
      isAddress(c.PASS_ADDRESS) &&
      !same(c.PASS_ADDRESS, BMC) &&
      !/^0x0{36}dead$/i.test(c.PASS_ADDRESS) &&
      c.GENESIS_CID === CID &&
      l.DESIGN === "block-random-v1" &&
      build.design === l.DESIGN &&
      /^https:\/\/[^\s]+$/.test(l.SOURCE_REPOSITORY || "") &&
      /^[0-9a-f]{40}$/i.test(l.SOURCE_COMMIT || "") &&
      l.CONFIRMED_ABI_SHA256 === build.abiSha256 &&
      /^[0-9a-f]{64}$/i.test(l.REVIEWED_RUNTIME_SHA256 || "") &&
      l.EXPLORER_VERIFIED === true &&
      l.SECURITY_FINDINGS_ADDRESSED === true &&
      l.DEPLOYED_MINT_AND_BURN_VALIDATED === true &&
      typeof l.PUBLIC_MINT_AUTHORIZATION === "string" &&
      l.PUBLIC_MINT_AUTHORIZATION.trim().length > 0
    );
  }
  function friendlyError(e) {
    const code = e?.code ?? e?.data?.originalError?.code;
    if (code === 4001)
      return "Request rejected in your wallet. No further transaction was sent.";
    if (code === -32002)
      return "A wallet request is already open. Finish or reject it in your wallet.";
    if (code === 4900 || code === 4901)
      return "Wallet disconnected. Reconnect on Ethereum Mainnet.";
    if (code === 4100)
      return "Wallet access is not authorized. Connect your wallet again.";
    return (
      e?.message ||
      "Wallet or network request failed. Check your wallet and try again."
    );
  }
  class MintClient {
    constructor(config, build, tokenBuild, options = {}) {
      this.config = config;
      this.build = build;
      this.tokenBuild = tokenBuild;
      this.provider = null;
      this.epoch = 0;
      this.connectionId = 0;
      this.handlers = null;
      this.onChange = options.onChange || (() => {});
      this.onTransaction = options.onTransaction || (() => {});
      // Every write needs a fresh, explicit in-page review in addition to wallet confirmation.
      this.confirmTransaction =
        options.confirmTransaction || (async () => false);
      this.pollMs = options.pollMs ?? 4000;
      this.maxPolls = options.maxPolls ?? 75;
      this.sleep =
        options.sleep ||
        ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
      this.storage = options.storage;
      this.key = `bmc-pass-pending:1:${config.PASS_ADDRESS.toLowerCase()}`;
      this.state = {
        account: null,
        chainId: null,
        busy: false,
        ready: false,
        balance: null,
        allowance: null,
        stats: null,
        pending: null,
        message: "",
        minted: null,
      };
      try {
        const saved = JSON.parse(this.storage?.getItem(this.key) || "null");
        if (
          saved &&
          (isHash(saved.hash) || saved.uncertain === true) &&
          isAddress(saved.account) &&
          same(saved.pass, config.PASS_ADDRESS) &&
          ["approval", "mint", "reveal"].includes(saved.stage)
        )
          this.state.pending = saved;
      } catch {
        /* Corrupt or disabled storage does not create an executable transaction. */
      }
    }
    get live() {
      return configuredLive(this.config, this.build);
    }
    emit(message) {
      if (message !== undefined) this.state.message = message;
      this.onChange(this.state);
    }
    detach() {
      if (this.provider?.removeListener && this.handlers) {
        for (const [event, handler] of Object.entries(this.handlers))
          this.provider.removeListener(event, handler);
      }
      this.handlers = null;
    }
    invalidate(message) {
      ++this.epoch;
      Object.assign(this.state, {
        ready: false,
        balance: null,
        allowance: null,
        stats: null,
        minted: null,
      });
      this.emit(message);
    }
    attach(provider) {
      this.detach();
      this.provider = provider;
      this.handlers = {
        accountsChanged: (accounts) => {
          this.state.account = isAddress(accounts?.[0]) ? accounts[0] : null;
          this.invalidate(
            this.state.account
              ? "Wallet account changed. Review the account before minting."
              : "Wallet disconnected.",
          );
          this.refresh().catch((e) => this.emit(friendlyError(e)));
        },
        chainChanged: (chain) => {
          this.state.chainId = chain;
          this.invalidate(
            chain === "0x1"
              ? "Ethereum Mainnet selected."
              : "Wrong network. Switch to Ethereum Mainnet.",
          );
          this.refresh().catch((e) => this.emit(friendlyError(e)));
        },
        disconnect: () => {
          ++this.connectionId;
          this.state.account = null;
          this.state.chainId = null;
          this.invalidate(
            "Wallet disconnected. Any submitted transaction may still be pending on Ethereum.",
          );
        },
      };
      if (provider.on)
        for (const [event, handler] of Object.entries(this.handlers))
          provider.on(event, handler);
    }
    async connect(provider, prompt = true) {
      if (this.state.busy)
        throw new Error("Finish the current wallet request first.");
      if (!provider || typeof provider.request !== "function")
        throw new Error(
          "No injected wallet found. Open this page in MetaMask or another EIP-1193 wallet browser.",
        );
      const connectionId = ++this.connectionId;
      this.attach(provider);
      this.invalidate();
      try {
        if (prompt) await provider.request({ method: "eth_requestAccounts" });
        // Wallets commonly emit accountsChanged while the connection prompt is resolving.
        const [accounts, chain] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);
        if (connectionId !== this.connectionId || this.provider !== provider)
          return;
        this.state.account = isAddress(accounts?.[0]) ? accounts[0] : null;
        this.state.chainId = chain;
        this.emit(
          !this.state.account
            ? "Wallet not connected."
            : chain === "0x1"
              ? "Wallet connected."
              : "Wrong network. Switch to Ethereum Mainnet.",
        );
        await this.refresh();
      } catch (e) {
        if (connectionId === this.connectionId && this.provider === provider) {
          this.state.account = null;
          this.invalidate(friendlyError(e));
        }
        throw e;
      }
    }
    disconnect() {
      ++this.connectionId;
      this.detach();
      this.provider = null;
      this.state.account = null;
      this.state.chainId = null;
      this.invalidate(
        "Disconnected from this page. Wallet permissions and submitted transactions are unchanged.",
      );
    }
    async switchNetwork() {
      if (!this.provider) throw new Error("Connect your wallet first.");
      if (this.state.busy)
        throw new Error("Finish the current wallet request first.");
      await this.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      await this.connect(this.provider, false);
    }
    session() {
      if (!this.provider || !this.state.account)
        throw new Error("Connect your wallet first.");
      return {
        provider: this.provider,
        account: this.state.account,
        epoch: this.epoch,
      };
    }
    async assertSession(session, requireLive = false) {
      if (requireLive && !this.live)
        throw new Error("BMC PASS — Coming Soon. Public minting is disabled.");
      if (
        this.epoch !== session.epoch ||
        this.provider !== session.provider ||
        !same(this.state.account, session.account)
      )
        throw new Error(
          "Wallet changed. The flow stopped; check any submitted transaction before continuing.",
        );
      const [chain, accounts] = await Promise.all([
        session.provider.request({ method: "eth_chainId" }),
        session.provider.request({ method: "eth_accounts" }),
      ]);
      if (chain !== "0x1")
        throw new Error("Wrong network. Switch to Ethereum Mainnet.");
      if (!same(accounts?.[0], session.account) || this.epoch !== session.epoch)
        throw new Error(
          "Wallet account changed. No further transaction was sent.",
        );
    }
    async read(session, target, build, signature, args = []) {
      return session.provider.request({
        method: "eth_call",
        params: [
          { to: target, data: calldata(build, signature, args) },
          "latest",
        ],
      });
    }
    async nft(session, signature, args = []) {
      return this.read(
        session,
        this.config.PASS_ADDRESS,
        this.build,
        signature,
        args,
      );
    }
    async token(session, signature, args = []) {
      return this.read(session, BMC, this.tokenBuild, signature, args);
    }
    async verifyContract(session) {
      await this.assertSession(session, true);
      const code = await session.provider.request({
        method: "eth_getCode",
        params: [this.config.PASS_ADDRESS, "latest"],
      });
      if (
        (await sha256Hex(code)) !==
        this.config.LAUNCH.REVIEWED_RUNTIME_SHA256.toLowerCase()
      )
        throw new Error(
          "NFT bytecode differs from the reviewed deployment. Minting disabled.",
        );
      const [token, max, genesis, mystery, cid, name, symbol, erc721] =
        await Promise.all([
          this.nft(session, "BMC()"),
          this.nft(session, "MAX_SUPPLY()"),
          this.nft(session, "GENESIS_PRICE()"),
          this.nft(session, "MYSTERY_PRICE()"),
          this.nft(session, "genesisImagesCID()"),
          this.nft(session, "name()"),
          this.nft(session, "symbol()"),
          this.nft(session, "supportsInterface(bytes4)", ["0x80ac58cd"]),
        ]);
      if (
        uint(token) !== BigInt(BMC) ||
        uint(max) !== 500n ||
        uint(genesis) !== GENESIS ||
        uint(mystery) !== MYSTERY ||
        decodeString(cid) !== CID ||
        decodeString(name) !== "BMC Illuminati Pass" ||
        decodeString(symbol) !== "BMCPASS" ||
        uint(erc721) !== 1n
      ) {
        throw new Error(
          "NFT contract configuration does not match the approved collection. Minting disabled.",
        );
      }
      await this.assertSession(session, true);
    }
    async balances(session, allowance = false) {
      if (this.config.BMC_RUNTIME_SHA256) {
        const code = await session.provider.request({
          method: "eth_getCode",
          params: [BMC, "latest"],
        });
        if ((await sha256Hex(code)) !== this.config.BMC_RUNTIME_SHA256)
          throw new Error(
            "BMC bytecode differs from the verified token. Reads and minting disabled.",
          );
      }
      const [decimals, balance] = await Promise.all([
        this.token(session, "decimals()"),
        this.token(session, "balanceOf(address)", [session.account]),
      ]);
      if (uint(decimals) !== 18n)
        throw new Error("Unexpected BMC decimals. Minting disabled.");
      const approved = allowance
        ? uint(
            await this.token(session, "allowance(address,address)", [
              session.account,
              this.config.PASS_ADDRESS,
            ]),
          )
        : null;
      return { balance: uint(balance), allowance: approved };
    }
    async stats(session) {
      // Pin related inventory reads to one block so another buyer cannot produce an inconsistent snapshot.
      const block = await session.provider.request({
        method: "eth_blockNumber",
      });
      const signatures = [
        "totalMinted()",
        "remainingSupply()",
        "totalBurned()",
        "currentPrice()",
        "remainingMysteryGenesis()",
        "remainingMysteryStandard()",
        "pendingReveals()",
        "mintingOpen()",
      ];
      const results = await Promise.all(
        signatures.map((sig) =>
          session.provider.request({
            method: "eth_call",
            params: [
              {
                to: this.config.PASS_ADDRESS,
                data: calldata(this.build, sig),
              },
              block,
            ],
          }),
        ),
      );
      const [
        minted,
        remaining,
        burned,
        price,
        genesis,
        standard,
        pending,
        openWord,
      ] = results.map(uint);
      const mysterySold = minted > 40n ? minted - 40n : 0n;
      const expectedBurn =
        (minted < 40n ? minted : 40n) * GENESIS + mysterySold * MYSTERY;
      if (
        minted > 500n ||
        remaining !== 500n - minted ||
        burned !== expectedBurn ||
        genesis > 37n ||
        standard > 423n ||
        pending > mysterySold ||
        genesis + standard !== 460n - (mysterySold - pending) ||
        openWord > 1n ||
        price !== (minted >= 500n ? 0n : minted < 40n ? GENESIS : MYSTERY)
      ) {
        throw new Error(
          "Inconsistent NFT contract state. Refresh before minting.",
        );
      }
      return {
        minted,
        remaining,
        burned,
        price,
        genesis,
        standard,
        pending,
        open: openWord === 1n,
      };
    }
    async refresh() {
      this.state.ready = false;
      if (!this.provider || !this.state.account) {
        this.emit();
        return;
      }
      const session = this.session();
      try {
        await this.assertSession(session);
        const balances = await this.balances(
          session,
          this.live || isAddress(this.config.PASS_ADDRESS),
        );
        let stats = null;
        if (this.live) {
          await this.verifyContract(session);
          stats = await this.stats(session);
        }
        await this.assertSession(session);
        Object.assign(this.state, balances, { stats, ready: this.live });
        this.emit();
      } catch (e) {
        if (session.epoch === this.epoch) {
          Object.assign(this.state, {
            ready: false,
            balance: null,
            allowance: null,
            stats: null,
          });
          this.emit(friendlyError(e));
        }
      }
    }
    async preflight(session, kind) {
      await this.verifyContract(session);
      const [stats, balances] = await Promise.all([
        this.stats(session),
        this.balances(session, true),
      ]);
      if (!stats.open)
        throw new Error(
          "BMC PASS — Coming Soon. The NFT contract owner has not opened minting yet.",
        );
      if (stats.minted === 500n)
        throw new Error("All 500 passes have been minted.");
      if ((kind === "genesis") !== stats.minted < 40n)
        throw new Error(
          "The mint phase changed. Refresh and review the current phase.",
        );
      if (balances.balance < stats.price)
        throw new Error("Insufficient BMC balance for this mint.");
      await this.assertSession(session, true);
      Object.assign(this.state, balances, { stats, ready: true });
      this.emit();
      return { ...stats, ...balances };
    }
    savePending(pending) {
      this.state.pending = pending;
      try {
        if (pending) this.storage?.setItem(this.key, JSON.stringify(pending));
        else this.storage?.removeItem(this.key);
      } catch {
        /* The in-memory lock remains if browser storage is unavailable. */
      }
      this.emit();
    }
    async send(session, target, data, stage, tokenId) {
      await this.assertSession(session, true);
      // Simulate just before opening the wallet. Reverts stop here without a paid transaction.
      await session.provider.request({
        method: "eth_call",
        params: [{ from: session.account, to: target, data }, "latest"],
      });
      const estimated = BigInt(
        await session.provider.request({
          method: "eth_estimateGas",
          params: [{ from: session.account, to: target, data }],
        }),
      );
      // Mystery's next-block outcome can touch different storage than the simulation. Leave room
      // for the more expensive branch; the wallet still displays/controls the transaction fee.
      const gas = "0x" + (estimated + estimated / 5n + 50000n).toString(16);
      const gasPrice = BigInt(
        await session.provider.request({ method: "eth_gasPrice" }),
      );
      if (gasPrice <= 0n || estimated <= 0n)
        throw new Error(
          "Network fee could not be estimated. No transaction was requested.",
        );
      const amount =
        stage === "approval"
          ? BigInt("0x" + data.slice(74))
          : stage === "mint"
            ? this.state.stats.price
            : 0n;
      const accepted = await this.confirmTransaction({
        stage,
        from: session.account,
        to: target,
        spender: stage === "approval" ? this.config.PASS_ADDRESS : null,
        amount,
        estimatedFee: BigInt(gas) * gasPrice,
        gas: BigInt(gas),
        chainId: 1,
        value: 0n,
      });
      if (accepted !== true)
        throw new Error(
          "Transaction review cancelled. No further transaction was sent.",
        );
      await this.verifyContract(session);
      if (stage !== "reveal") {
        const current = await this.stats(session);
        if (!current.open || current.price !== amount || current.minted >= 500n)
          throw new Error(
            "The mint phase or price changed. Review it again before continuing.",
          );
      }
      await session.provider.request({
        method: "eth_call",
        params: [{ from: session.account, to: target, data }, "latest"],
      });
      await this.assertSession(session, true);
      this.emit(
        stage === "approval"
          ? "Approve the exact mint price in your wallet."
          : stage === "reveal"
            ? "Confirm the reveal in your wallet. It settles pending passes in mint order and burns no BMC."
            : "Confirm the mint in your wallet. BMC will be permanently burned.",
      );
      let hash;
      // Persist BEFORE the wallet prompt: closing/reloading the page must not permit a duplicate.
      this.savePending({
        hash: null,
        uncertain: true,
        stage,
        account: session.account,
        pass: this.config.PASS_ADDRESS,
      });
      try {
        hash = await session.provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: session.account,
              to: target,
              data,
              gas,
              chainId: "0x1",
              value: "0x0",
            },
          ],
        });
        if (!isHash(hash))
          throw new Error("Wallet returned an invalid transaction hash.");
      } catch (error) {
        if (error?.code !== 4001 && error?.code !== -32002) {
          // A transport error can happen AFTER broadcast. Persist an unresolved lock, not a retry button.
          this.savePending({
            hash: null,
            uncertain: true,
            stage,
            account: session.account,
            pass: this.config.PASS_ADDRESS,
          });
          throw new Error(
            "Submission outcome unknown. Check wallet activity on Ethereum before any further action; this page remains locked to prevent a duplicate.",
          );
        }
        this.savePending(null); // Explicit rejection / request-not-accepted did not submit this call.
        throw error;
      }
      const pending = {
        hash,
        stage,
        account: session.account,
        pass: this.config.PASS_ADDRESS,
        ...(tokenId !== undefined ? { tokenId: String(tokenId) } : {}),
      };
      this.savePending(pending);
      this.onTransaction({ ...pending, status: "pending" });
      return pending;
    }
    async receipt(session, pending) {
      if (pending.uncertain)
        throw new Error(
          "No transaction hash was returned. Resolve the submission in wallet activity; this page cannot safely resubmit or infer a replacement hash.",
        );
      await this.assertSession(session);
      const receipt = await session.provider.request({
        method: "eth_getTransactionReceipt",
        params: [pending.hash],
      });
      await this.assertSession(session);
      if (!receipt) return null;
      if (
        !same(receipt.transactionHash, pending.hash) ||
        !same(receipt.from, pending.account) ||
        !same(receipt.to, pending.stage === "approval" ? BMC : pending.pass) ||
        !["0x1", "0x0"].includes(receipt.status)
      ) {
        throw new Error(
          "Unexpected transaction receipt. Check the transaction on Etherscan.",
        );
      }
      // Require two blocks of confirmation and verify the receipt remains on the canonical chain.
      const tip = BigInt(
        await session.provider.request({ method: "eth_blockNumber" }),
      );
      if (tip < BigInt(receipt.blockNumber) + 1n) return null;
      const block = await session.provider.request({
        method: "eth_getBlockByNumber",
        params: [receipt.blockNumber, false],
      });
      if (!block || !same(block.hash, receipt.blockHash)) return null;
      this.onTransaction({
        ...pending,
        status: receipt.status === "0x1" ? "confirmed" : "reverted",
      });
      this.savePending(null);
      if (receipt.status !== "0x1")
        throw new Error(
          "Transaction reverted. No further transaction was sent; gas may have been spent.",
        );
      return receipt;
    }
    async wait(session, pending) {
      for (let i = 0; i < this.maxPolls; ++i) {
        const receipt = await this.receipt(session, pending);
        if (receipt) return receipt;
        this.emit(
          `${pending.stage === "approval" ? "Approval" : pending.stage === "reveal" ? "Reveal" : "Mint"} pending — waiting for two confirmations. Do not submit it again.`,
        );
        await this.sleep(this.pollMs);
      }
      throw new Error(
        "Transaction is still pending or was replaced. Check Etherscan or your wallet, then use Check pending transaction. No mint was resubmitted.",
      );
    }
    async waitForBlock(session, target) {
      for (let i = 0; i < this.maxPolls; ++i) {
        await this.assertSession(session);
        if (
          BigInt(
            await session.provider.request({ method: "eth_blockNumber" }),
          ) >= target
        )
          return;
        this.emit("Waiting for the reveal block to be available…");
        await this.sleep(this.pollMs);
      }
      throw new Error(
        "The reveal block is not available yet. Use Reveal pending passes once Ethereum advances; your mint is already final.",
      );
    }
    async revealPending(session, tokenId, mintBlock) {
      // Settle in mint order; everything ahead of this token is settled by the same call.
      if (mintBlock !== undefined)
        await this.waitForBlock(session, mintBlock + 2n);
      const count = uint(await this.nft(session, "pendingReveals()"));
      if (count === 0n) return null;
      const pending = await this.send(
        session,
        this.config.PASS_ADDRESS,
        calldata(this.build, "reveal(uint256)", [count > 50n ? 50n : count]),
        "reveal",
        tokenId,
      );
      await this.wait(session, pending);
      if (tokenId !== undefined)
        await this.showToken(session, tokenId, this.state.minted?.hash);
      return pending;
    }
    async showToken(session, id, hash) {
      this.state.minted = { id, hash, metadata: null, pending: false };
      try {
        const tier = uint(await this.nft(session, "tierOf(uint256)", [id]));
        this.state.minted.pending = tier === 0n;
        this.state.minted.metadata = await this.metadata(session, id);
        this.emit(
          tier === 0n
            ? `Pass #${id} is minted and awaiting its reveal. The outcome settles from the next block's hash.`
            : `BMC Illuminati Pass #${id} revealed.`,
        );
      } catch {
        this.emit(
          `Pass #${id} minted. Artwork could not be loaded; use the transaction link or look up this token again.`,
        );
      }
      this.emit();
    }
    async mintedFromReceipt(session, receipt) {
      const log = receipt.logs?.find(
        (l) =>
          same(l.address, this.config.PASS_ADDRESS) &&
          same(l.topics?.[0], TRANSFER) &&
          l.topics?.length === 4 &&
          /^0x0{64}$/i.test(l.topics[1]) &&
          same("0x" + l.topics[2].slice(-40), session.account),
      );
      if (!log)
        throw new Error(
          "Mint confirmed, but no matching NFT mint event was found. Check Etherscan before any further action.",
        );
      const id = uint(log.topics[3]);
      if (id < 1n || id > 500n) throw new Error("Unexpected minted token ID.");
      this.emit(
        `BMC Illuminati Pass #${id} minted. Your BMC was permanently burned.`,
      );
      await this.showToken(session, id, receipt.transactionHash);
      return id;
    }
    async metadata(session, id) {
      await this.assertSession(session, true);
      const uri = decodeString(
        await this.nft(session, "tokenURI(uint256)", [id]),
      );
      return decodeMetadata(uri, this.config.IPFS_GATEWAY);
    }
    async lookup(id) {
      if (!this.live)
        throw new Error("NFT lookup will open after the approved deployment.");
      id = BigInt(id);
      if (id < 1n || id > 500n)
        throw new Error("Enter a token ID from 1 to 500.");
      const session = this.session();
      await this.verifyContract(session);
      return this.metadata(session, id);
    }
    async mint(kind) {
      if (!this.live)
        throw new Error("BMC PASS — Coming Soon. Public minting is disabled.");
      if (!["genesis", "mystery"].includes(kind))
        throw new Error("Unknown mint phase.");
      if (this.state.busy || this.state.pending)
        throw new Error(
          "A transaction is already in progress. Check it before starting another mint.",
        );
      const session = this.session();
      this.state.busy = true;
      this.emit();
      try {
        let check = await this.preflight(session, kind);
        if (check.allowance < check.price) {
          const approval = await this.send(
            session,
            BMC,
            calldata(this.tokenBuild, "approve(address,uint256)", [
              this.config.PASS_ADDRESS,
              check.price,
            ]),
            "approval",
          );
          await this.wait(session, approval);
          // Never continue after a rejected/reverted/pending approval or a changed account/network/phase.
          check = await this.preflight(session, kind);
          if (check.allowance < check.price)
            throw new Error(
              "Approval confirmed but allowance is still insufficient. No mint was sent.",
            );
        }
        const pending = await this.send(
          session,
          this.config.PASS_ADDRESS,
          calldata(
            this.build,
            kind === "genesis" ? "mintGenesis()" : "mintMystery()",
          ),
          "mint",
        );
        const receipt = await this.wait(session, pending);
        const id = await this.mintedFromReceipt(session, receipt);
        // Mystery: the burn is final; the outcome is settled by a separate reveal from the next block's hash.
        if (kind === "mystery")
          this.emit(
            `Pass #${id} minted. Review and request its reveal separately once the next block is available.`,
          );
      } catch (e) {
        this.emit(friendlyError(e));
        throw e;
      } finally {
        this.state.busy = false;
        await this.refresh();
        this.emit();
      }
    }
    async reveal() {
      if (!this.live)
        throw new Error("BMC PASS — Coming Soon. Public minting is disabled.");
      if (this.state.busy || this.state.pending)
        throw new Error(
          "A transaction is already in progress. Check it before starting another.",
        );
      const session = this.session();
      this.state.busy = true;
      this.emit();
      try {
        await this.verifyContract(session);
        const pending = await this.revealPending(
          session,
          this.state.minted?.pending ? this.state.minted.id : undefined,
        );
        if (!pending) this.emit("No passes are waiting for a reveal.");
      } catch (e) {
        this.emit(friendlyError(e));
        throw e;
      } finally {
        this.state.busy = false;
        await this.refresh();
        this.emit();
      }
    }
    async checkPending() {
      if (this.state.busy)
        throw new Error("Wait for the current wallet request to finish.");
      const pending = this.state.pending;
      if (!pending) return;
      const session = this.session();
      if (!same(session.account, pending.account))
        throw new Error(
          "Reconnect the wallet that submitted this transaction.",
        );
      this.state.busy = true;
      this.emit();
      try {
        const receipt = await this.receipt(session, pending);
        if (!receipt) {
          this.emit(
            "Still pending, replaced, or awaiting two confirmations. Check Etherscan and your wallet; no new transaction was sent.",
          );
          return;
        }
        if (pending.stage === "mint")
          await this.mintedFromReceipt(session, receipt);
        else if (pending.stage === "reveal") {
          if (/^[0-9]+$/.test(pending.tokenId || ""))
            await this.showToken(
              session,
              BigInt(pending.tokenId),
              this.state.minted?.hash,
            );
          else this.emit("Reveal confirmed.");
        } else
          this.emit(
            "Approval confirmed. Review the current phase and press Mint when ready.",
          );
      } finally {
        this.state.busy = false;
        await this.refresh();
        this.emit();
      }
    }
  }
  root.BMCMint = {
    MintClient,
    configuredLive,
    calldata,
    uint,
    decodeString,
    sha256Hex,
    decodeMetadata,
    friendlyError,
    isAddress,
    GENESIS,
    MYSTERY,
    CID,
    BMC,
  };
  if (typeof module !== "undefined") module.exports = root.BMCMint;
})(globalThis);
