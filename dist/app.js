/* Mint page UI. Every write requires in-page review, then a wallet confirmation; PRE_LAUNCH denies all writes. */
(function () {
  "use strict";
  const C = window.BMC_PASS_CONFIG,
    API = window.BMCMint,
    P = window.BMCPlatform,
    client = P.client;
  const $ = (id) => document.getElementById(id);
  const fmt = (value) =>
    value === null || value === undefined
      ? "Unavailable"
      : P.format(value) + " BMC";
  const transactions = new Map(),
    providers = [];
  let lastMint = null,
    lastAccount = null,
    connecting = false,
    reviewAccount = null,
    lookupBusy = false,
    flowTrigger = null,
    restoreFocus = null;
  function status(message) {
    $("message").textContent = message;
  }
  function transaction(tx) {
    if (!API.isAddress(tx.account) || !/^0x[0-9a-f]{64}$/i.test(tx.hash))
      return;
    transactions.set(tx.hash, tx);
    const list = $("txlog");
    list.replaceChildren();
    for (const item of [...transactions.values()].reverse()) {
      const li = document.createElement("li"),
        link = document.createElement("a"),
        label = document.createElement("span");
      link.href = `https://etherscan.io/tx/${item.hash}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${item.stage === "approval" ? "BMC approval" : item.stage === "reveal" ? "Pass reveal" : "Pass mint"} · ${item.hash.slice(0, 10)}…${item.hash.slice(-6)}`;
      label.className = "pill";
      label.textContent = `${item.status} · from ${item.account.slice(0, 6)}…${item.account.slice(-4)}`;
      li.append(link, " ", label);
      list.append(li);
    }
  }
  function showNFT(container, metadata, id, hash, pending) {
    container.replaceChildren();
    container.hidden = false;
    const heading = document.createElement("h3");
    heading.textContent = metadata?.name || `BMC Illuminati Pass #${id}`;
    container.append(heading);
    if (pending) {
      const note = document.createElement("p");
      note.textContent =
        "Awaiting reveal. Request a separate reveal once the next block is available; the burn has already happened.";
      container.append(note);
    }
    if (metadata) {
      const image = document.createElement("img");
      image.src = metadata.image;
      image.alt = metadata.name;
      image.width = 360;
      image.height = 360;
      image.addEventListener(
        "error",
        () => {
          image.hidden = true;
          const error = document.createElement("p");
          error.className = "error";
          error.textContent =
            "Artwork could not load. The ownership record is unchanged; try the metadata lookup again.";
          container.append(error);
        },
        { once: true },
      );
      container.append(image);
    } else {
      const note = document.createElement("p");
      note.textContent =
        "Metadata is unavailable. Check the confirmed transaction and retry the token lookup.";
      container.append(note);
    }
    const link = document.createElement("a");
    link.href = hash
      ? `https://etherscan.io/tx/${hash}`
      : `https://etherscan.io/token/${C.PASS_ADDRESS}?a=${id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = hash
      ? "View mint transaction on Etherscan"
      : "View this Pass on Etherscan";
    container.append(link);
  }
  function render() {
    const s = client.state,
      shared = P.snapshot(),
      live = client.live,
      correctChain = s.chainId === "0x1";
    if (lastAccount !== s.account) {
      lastAccount = s.account;
      lastMint = null;
      $("mint-result").hidden = true;
      $("mint-result").replaceChildren();
    }
    if (
      reviewAccount &&
      (s.account?.toLowerCase() !== reviewAccount.toLowerCase() ||
        !correctChain)
    )
      $("transaction-review").close("cancel");
    $("launch-title").textContent = "Mint your BMC Pass";
    $("network").textContent = !s.account
      ? "Wallet not connected"
      : correctChain
        ? "Ethereum Mainnet · Chain ID 1"
        : `Wrong network (${s.chainId || "unknown"}) · Ethereum required`;
    $("network").classList.toggle("error", !!s.account && !correctChain);
    $("account").textContent = s.account || "No wallet connected";
    $("connect").textContent = connecting ? "Connecting…" : "Connect wallet";
    $("connect").hidden = !!s.account;
    $("connect").disabled = connecting || s.busy;
    $("disconnect").hidden = !s.account;
    $("switch-network").hidden = !s.account || correctChain;
    $("switch-network").disabled = s.busy;
    $("wallet-provider").disabled = s.busy || connecting;
    $("balance").textContent = s.account ? fmt(s.balance) : "Connect wallet";
    $("allowance").textContent = s.account
      ? fmt(s.allowance)
      : "Connect wallet";
    $("message").textContent =
      s.message || "Connection requests account access only.";
    const stats = shared.public;
    $("phase").textContent = stats
      ? !stats.open
        ? "Not opened"
        : stats.minted >= 500n
          ? "Sold out"
          : stats.minted < 40n
            ? "Genesis"
            : "Mystery"
      : shared.loading
        ? "Reading…"
        : "Unavailable";
    $("price").textContent = stats
      ? stats.price
        ? fmt(stats.price)
        : "Sold out"
      : "Unavailable";
    $("supply").textContent = `${stats ? stats.minted : "Unavailable"} / 500`;
    $("remaining").textContent = stats
      ? String(stats.remaining)
      : "Unavailable";
    $("pending-reveals").textContent = stats
      ? String(stats.pending)
      : "Unavailable";
    $("burned").textContent = fmt(stats?.burned);
    $("stats-note").textContent = shared.loading
      ? "Reading Ethereum…"
      : shared.publicError ||
        `Read-only IMD deployment · Ethereum block ${BigInt(stats.block).toLocaleString("en-US")}. Opening on-chain does not bypass this site's launch checks.`;
    $("refresh-data").disabled = shared.loading;
    $("genesis-left").textContent = stats
      ? stats.minted < 40n
        ? `${40n - stats.minted} Genesis mints remain in phase 1.`
        : "Phase 1 complete."
      : "40 Genesis mints in phase 1. Current availability is unknown.";
    $("odds").textContent = stats
      ? `Inventory: ${stats.genesis} Genesis, ${stats.standard} Standard; ${stats.pending} waiting for reveal. Inventory ratios do not guarantee fair odds.`
      : "Initial design: 37 Genesis and 423 Standard outcomes. Live inventory is unavailable.";
    const chainStats = s.stats;
    const locked =
      !live ||
      !s.ready ||
      !correctChain ||
      !s.account ||
      s.busy ||
      !!s.pending ||
      !chainStats ||
      !chainStats.open;
    $("mint-genesis").disabled = locked || chainStats.minted >= 40n;
    $("mint-mystery").disabled =
      locked ||
      chainStats.minted < 40n ||
      chainStats.minted >= 500n ||
      !$("risk-accepted").checked;
    $("reveal-pending").hidden = !(
      stats?.pending > 0n || chainStats?.pending > 0n
    );
    $("reveal-pending").disabled = locked;
    $("lookup").disabled = lookupBusy;
    $("check-pending").hidden = !s.pending;
    $("check-pending").disabled = s.busy || !s.account || !correctChain;
    if (s.pending?.uncertain && !s.busy)
      $("message").textContent =
        "Submission outcome unknown. This page remains locked. Check Ethereum wallet activity before taking any further action.";
    if (s.pending)
      transaction({ ...s.pending, status: "Pending; check before retrying" });
    if (s.minted) {
      const fingerprint = `${s.minted.id}:${s.minted.metadata?.image || ""}:${s.minted.pending}`;
      if (fingerprint !== lastMint) {
        lastMint = fingerprint;
        showNFT(
          $("mint-result"),
          s.minted.metadata,
          s.minted.id,
          s.minted.hash,
          s.minted.pending,
        );
      }
    }
  }
  function reviewTransaction(tx) {
    return new Promise((resolve) => {
      const dialog = $("transaction-review"),
        trigger = flowTrigger || document.activeElement;
      reviewAccount = tx.from;
      $("review-title").textContent =
        tx.stage === "approval"
          ? "Approve the exact BMC amount"
          : tx.stage === "reveal"
            ? "Reveal pending Passes"
            : "Mint and permanently burn BMC";
      $("review-from").textContent = tx.from;
      $("review-to").textContent = tx.to;
      $("review-spender-row").hidden = !tx.spender;
      $("review-spender").textContent = tx.spender || "";
      $("review-amount").textContent = fmt(tx.amount);
      $("review-fee").textContent = P.format(tx.estimatedFee, 18, 9) + " ETH";
      $("review-warning").textContent =
        tx.stage === "mint"
          ? "This mint destroys BMC permanently. The wallet displays the final network fee, which can change."
          : "This action does not burn BMC. Review the final network fee in your wallet, which can change.";
      const finish = () => {
        dialog.removeEventListener("close", finish);
        reviewAccount = null;
        restoreFocus = trigger;
        resolve(dialog.returnValue === "confirm");
      };
      dialog.returnValue = "cancel";
      dialog.addEventListener("close", finish);
      $("review-cancel").onclick = () => dialog.close("cancel");
      $("review-confirm").onclick = () => dialog.close("confirm");
      dialog.showModal();
      $("review-cancel").focus();
    });
  }
  client.confirmTransaction = reviewTransaction;
  client.onTransaction = transaction;
  const run = (fn) => async (event) => {
    flowTrigger = event?.currentTarget || document.activeElement;
    try {
      await fn();
    } catch (e) {
      status(API.friendlyError(e));
    } finally {
      if (restoreFocus) {
        const target = restoreFocus;
        restoreFocus = null;
        requestAnimationFrame(() => {
          if (target?.isConnected && !target.disabled) target.focus();
          else {
            $("message").tabIndex = -1;
            $("message").focus();
          }
        });
      }
    }
  };
  function addProvider(provider, name) {
    if (!provider?.request || providers.some((p) => p.provider === provider))
      return;
    providers.push({ provider, name });
    const option = document.createElement("option");
    option.value = String(providers.length - 1);
    option.textContent = name;
    $("wallet-provider").append(option);
    $("wallet-choice").hidden = providers.length < 2;
  }
  for (const entry of P.snapshot().providers)
    addProvider(entry.provider, entry.name);
  window.addEventListener("eip6963:announceProvider", (event) =>
    addProvider(
      event.detail?.provider,
      String(event.detail?.info?.name || "Injected wallet").slice(0, 80),
    ),
  );
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  $("connect").onclick = run(async () => {
    connecting = true;
    render();
    try {
      await client.connect(
        providers[Number($("wallet-provider").value) || 0]?.provider ||
          window.ethereum,
      );
    } finally {
      connecting = false;
      render();
    }
  });
  $("disconnect").onclick = () => client.disconnect();
  $("switch-network").onclick = run(() => client.switchNetwork());
  $("risk-accepted").onchange = render;
  $("mint-genesis").onclick = run(() => client.mint("genesis"));
  $("mint-mystery").onclick = run(() => {
    if (!$("risk-accepted").checked)
      throw new Error("Acknowledge the Mystery risk before continuing.");
    return client.mint("mystery");
  });
  $("check-pending").onclick = run(() => client.checkPending());
  $("reveal-pending").onclick = run(() => client.reveal());
  $("refresh-data").onclick = () => {
    void P.refreshPublic();
    if (client.state.account) void client.refresh();
  };
  $("lookup-form").onsubmit = async (event) => {
    event.preventDefault();
    if (lookupBusy) return;
    const id = $("lookup-id").value;
    $("lookup-result").hidden = true;
    $("lookup-message").textContent = "Reading NFT metadata…";
    $("lookup-id").removeAttribute("aria-invalid");
    lookupBusy = true;
    render();
    try {
      showNFT($("lookup-result"), await P.lookup(id), id);
      $("lookup-message").textContent =
        "Metadata read from the source-matched collection.";
    } catch (e) {
      $("lookup-message").textContent = API.friendlyError(e);
      $("lookup-id").setAttribute("aria-invalid", "true");
    } finally {
      lookupBusy = false;
      render();
    }
  };
  function gallery() {
    const failures = new Set(),
      loaded = new Set();
    const summary = () => {
      $("artwork-status").textContent =
        `${loaded.size} / 77 previews loaded.${failures.size ? ` Unable to load: ${[...failures].join(", ")}. Use each original IPFS link.` : " Other previews load as you scroll."}`;
    };
    $("legendary").addEventListener("error", () => {
      $("hero-art-error").hidden = false;
    });
    for (let i = 1; i <= 77; i++) {
      const file = `genesis-${String(i).padStart(2, "0")}.png`,
        figure = document.createElement("figure"),
        img = document.createElement("img"),
        caption = document.createElement("figcaption"),
        link = document.createElement("a");
      img.src = `../artwork/genesis/${file.replace(".png", ".webp")}`;
      img.alt = `Genesis artwork #${i}`;
      img.loading = "lazy";
      img.width = 360;
      img.height = 360;
      img.addEventListener("load", () => {
        loaded.add(file);
        failures.delete(file);
        summary();
      });
      img.addEventListener("error", () => {
        failures.add(file);
        summary();
      });
      caption.textContent = `Genesis #${String(i).padStart(2, "0")} · ${i === 1 ? "Legendary" : i <= 40 ? "Early Genesis" : "Mystery inventory"}`;
      link.href = `${C.IPFS_GATEWAY}${C.GENESIS_CID}/${file}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Original on IPFS";
      caption.append(link);
      figure.append(img, caption);
      $("gallery").append(figure);
    }
    summary();
  }
  const token = new URLSearchParams(location.search).get("token");
  if (token && /^[1-9][0-9]{0,2}$/.test(token)) $("lookup-id").value = token;
  gallery();
  P.subscribe(render);
  render();
})();
