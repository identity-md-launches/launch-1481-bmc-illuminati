/* UI for /mint. No automatic approvals, signatures, or mint transactions. */
(function () {
  "use strict";
  const C = window.BMC_PASS_CONFIG, API = window.BMCMint;
  const $ = id => document.getElementById(id);
  const fmt = value => {
    if (value === null || value === undefined) return "—";
    const whole = value / 10n ** 18n, fraction = (value % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
    return whole.toLocaleString("en-US") + (fraction ? "." + fraction : "") + " BMC";
  };
  let storage;
  try { storage = window.localStorage; } catch { /* Private browsing can disable storage. */ }
  const providers = [], transactions = new Map();
  let lastMint = null, connecting = false;
  function status(message) { $("message").textContent = message; }
  function transaction(tx) {
    if (!API.isAddress(tx.account) || !/^0x[0-9a-f]{64}$/i.test(tx.hash)) return;
    transactions.set(tx.hash, tx);
    const list = $("txlog"); list.replaceChildren();
    for (const item of [...transactions.values()].reverse()) {
      const li = document.createElement("li"), link = document.createElement("a"), label = document.createElement("span");
      link.href = `https://etherscan.io/tx/${item.hash}`; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = `${item.stage === "approval" ? "BMC approval" : item.stage === "reveal" ? "PASS reveal" : "PASS mint"} · ${item.hash.slice(0, 10)}…${item.hash.slice(-6)}`;
      label.className = "pill"; label.textContent = item.status;
      li.append(link, " ", label); list.append(li);
    }
  }
  function showNFT(container, metadata, id, hash, pending) {
    container.replaceChildren(); container.hidden = false;
    const heading = document.createElement("h3"); heading.textContent = metadata?.name || `BMC Illuminati Pass #${id}`; container.append(heading);
    if (pending) { const note = document.createElement("p"); note.className = "hint"; note.textContent = "Awaiting reveal: the outcome settles from the hash of the block after the mint block. Press Reveal pending passes once it is final; anyone may reveal, and nobody can change the result."; container.append(note); }
    if (metadata) {
      const image = document.createElement("img"); image.src = metadata.image;
      image.alt = metadata.name; image.width = 400; image.height = 400;
      image.addEventListener("error", () => {
        image.hidden = true;
        const error = document.createElement("p"); error.className = "error";
        error.textContent = "NFT minted, but this artwork could not be loaded. No substitute is shown."; container.append(error);
      }, { once: true });
      container.append(image);
    } else { const note = document.createElement("p"); note.textContent = "Artwork unavailable. Look up this token again once the connection recovers."; container.append(note); }
    if (hash) {
      const link = document.createElement("a"); link.href = `https://etherscan.io/tx/${hash}`;
      link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "View mint transaction on Etherscan"; container.append(link);
    }
  }
  function render(s) {
    const live = client.live;
    $("launch-title").textContent = live ? "BMC PASS — Live Mint" : "BMC PASS — Coming Soon";
    $("launch-description").textContent = live ? "Mint a BMC Illuminati Pass on Ethereum Mainnet by permanently burning BMC." : "Explore the collection and connect your wallet. Public minting opens only after the final contract is deployed, verified, reviewed and explicitly approved.";
    const correctChain = s.chainId === "0x1";
    $("network").textContent = !s.account ? "Wallet not connected" : correctChain ? "Connected · Ethereum Mainnet" : "Wrong network · Ethereum Mainnet required";
    $("network").classList.toggle("error", !!s.account && !correctChain);
    $("account").textContent = s.account || "No wallet connected";
    $("connect").textContent = connecting ? "Connecting…" : "CONNECT WALLET";
    $("connect").hidden = !!s.account; $("connect").disabled = connecting || s.busy;
    $("disconnect").hidden = !s.account;
    $("switch-network").hidden = !s.account || correctChain;
    $("switch-network").disabled = s.busy;
    $("wallet-provider").disabled = s.busy || connecting;
    $("balance").textContent = s.account ? fmt(s.balance) : "Connect wallet";
    $("allowance").textContent = live ? fmt(s.allowance) : "Not available";
    $("message").textContent = s.message || (live ? "Connect your wallet to view the current mint state." : "Minting is disabled in pre-launch mode.");
    const stats = s.stats;
    $("phase").textContent = stats ? !stats.open ? "Not opened yet" : stats.minted >= 500n ? "Sold out" : stats.minted < 40n ? "Genesis" : "Mystery" : live ? "Awaiting contract data" : "Pre-launch";
    $("pending-reveals").textContent = stats ? String(stats.pending) : "—";
    if (stats && !stats.open) $("launch-title").textContent = "BMC PASS — Coming Soon";
    $("price").textContent = stats ? stats.price ? fmt(stats.price) : "Sold out" : "Not live";
    $("supply").textContent = `${stats ? stats.minted : "—"} / 500`;
    $("remaining").textContent = stats ? String(stats.remaining) : "—";
    $("burned").textContent = fmt(stats?.burned);
    $("stats-note").textContent = stats ? "Supply and burn totals are read from the NFT contract on Ethereum Mainnet." : "Minted, remaining supply and burn totals will be read from the actual deployed NFT contract. No live totals are available yet.";
    $("genesis-left").textContent = stats ? stats.minted < 40n ? `${40n - stats.minted} Genesis mints remain in phase 1. Mystery opens only after all 40 are sold.` : "Phase 1 complete." : "Coming soon · 40 Genesis mints in phase 1. Mystery opens only after all 40 are sold.";
    $("odds").textContent = stats ? `Remaining inventory: ${stats.genesis} Genesis and ${stats.standard} Standard outcomes, ${stats.pending} pass${stats.pending === 1n ? "" : "es"} awaiting reveal. The reveal block's proposer can bias allocation; inventory ratios are not guaranteed buyer odds.` : "Initial pool: 37 Genesis and 423 Standard. Inventory uniqueness is not a fairness guarantee.";
    const locked = !live || !s.ready || !correctChain || !s.account || s.busy || !!s.pending || !stats || !stats.open;
    $("mint-genesis").disabled = locked || stats.minted >= 40n;
    $("mint-mystery").disabled = locked || stats.minted < 40n || stats.minted >= 500n || !$("risk-accepted").checked;
    $("reveal-pending").hidden = !live || !stats || stats.pending === 0n;
    $("reveal-pending").disabled = locked;
    $("lookup").disabled = !live || !s.ready || s.busy;
    $("check-pending").hidden = !s.pending;
    $("check-pending").disabled = s.busy || !s.account || !correctChain;
    if (s.pending) transaction({ ...s.pending, status: "pending — check before retrying" });
    if (live) {
      $("contract-link").href = `https://etherscan.io/address/${C.PASS_ADDRESS}`;
      $("contract-link").textContent = C.PASS_ADDRESS;
      $("contract-link").target = "_blank"; $("contract-link").rel = "noopener noreferrer";
    }
    if (s.minted) {
      const fingerprint = `${s.minted.id}:${s.minted.metadata?.image || ""}`;
      const fingerprint2 = `${fingerprint}:${s.minted.pending ? "pending" : "final"}`;
      if (fingerprint2 !== lastMint) { lastMint = fingerprint2; showNFT($("mint-result"), s.minted.metadata, s.minted.id, s.minted.hash, s.minted.pending); }
    }
  }
  const client = new API.MintClient(C, window.BMC_PASS_BUILD, window.BMC_TOKEN_BUILD, { storage, onChange: render, onTransaction: transaction });
  const run = fn => async () => { try { await fn(); } catch (e) { status(API.friendlyError(e)); } };
  function addProvider(provider, name) {
    if (!provider?.request || providers.some(p => p.provider === provider)) return;
    providers.push({ provider, name });
    const option = document.createElement("option"); option.value = String(providers.length - 1); option.textContent = name;
    $("wallet-provider").append(option); $("wallet-choice").hidden = providers.length < 2;
  }
  // EIP-6963 discovery complements the traditional window.ethereum provider.
  window.addEventListener("eip6963:announceProvider", event => addProvider(event.detail?.provider, event.detail?.info?.name || "Injected wallet"));
  if (window.ethereum?.providers) for (const p of window.ethereum.providers) addProvider(p, p.isMetaMask ? "MetaMask" : "Injected wallet");
  else addProvider(window.ethereum, window.ethereum?.isMetaMask ? "MetaMask" : "Injected wallet");
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  $("connect").onclick = run(async () => {
    connecting = true; render(client.state);
    try { await client.connect(providers[Number($("wallet-provider").value) || 0]?.provider || window.ethereum); }
    finally { connecting = false; render(client.state); }
  });
  $("disconnect").onclick = () => client.disconnect();
  $("switch-network").onclick = run(() => client.switchNetwork());
  $("risk-accepted").onchange = () => render(client.state);
  $("mint-genesis").onclick = run(() => client.mint("genesis"));
  $("mint-mystery").onclick = run(() => {
    if (!$("risk-accepted").checked) throw new Error("Read and acknowledge the Mystery randomness risk before minting.");
    return client.mint("mystery");
  });
  $("check-pending").onclick = run(() => client.checkPending());
  $("reveal-pending").onclick = run(() => client.reveal());
  $("lookup").onclick = run(async () => {
    const id = $("lookup-id").value;
    if (!/^[1-9][0-9]{0,2}$/.test(id) || Number(id) > 500) throw new Error("Enter a token ID from 1 to 500.");
    $("lookup-message").textContent = "Reading NFT metadata…";
    try { showNFT($("lookup-result"), await client.lookup(id), id); $("lookup-message").textContent = ""; }
    catch (e) { $("lookup-message").textContent = API.friendlyError(e); }
  });
  function gallery() {
    const failures = new Set(), loaded = new Set();
    const summary = () => { $("artwork-status").textContent = `${loaded.size} / 77 Genesis previews loaded in this browser.${failures.size ? ` Unable to load: ${[...failures].join(", ")}. No images were substituted.` : " Remaining previews load as you scroll."}`; };
    $("legendary").addEventListener("error", () => { $("hero-art-error").hidden = false; });
    for (let i = 1; i <= 77; ++i) {
      const file = `genesis-${String(i).padStart(2, "0")}.png`;
      const figure = document.createElement("figure"), img = document.createElement("img"), caption = document.createElement("figcaption");
      img.src = `${C.IPFS_GATEWAY}${C.GENESIS_CID}/${file}`; img.alt = `Genesis artwork #${i}`; img.loading = "lazy"; img.width = 1024; img.height = 1024;
      img.addEventListener("load", () => { loaded.add(file); failures.delete(file); summary(); });
      img.addEventListener("error", () => { failures.add(file); caption.textContent = `${file} · failed to load`; caption.classList.add("error"); summary(); });
      caption.textContent = `${file}${i === 1 ? " · Legendary" : i <= 40 ? " · Early Genesis" : " · Mystery Genesis"}`;
      figure.append(img, caption); $("gallery").append(figure);
    }
    summary();
  }
  gallery(); render(client.state);
  // Read only; connection prompts happen only after an explicit click.
  setInterval(() => { if (!client.state.busy && client.state.account) client.refresh().catch(e => status(API.friendlyError(e))); }, 30000);
})();
