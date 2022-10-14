"use strict";

const defaults = {
  transactions: [],
};

const networkLabels = {
  1: "ETH Mainnet",
  3: "ETH Ropsten",
  4: "ETH Rinkeby",
  56: "BSC Mainnet",
  97: "BSC Testnet",
};

const networkSuffix = {
  3: " Network",
  4: " Network",
};

const netURLs = {
  1: "https://etherscan.io",
  3: "https://ropsten.etherscan.io",
  4: "https://rinkeby.etherscan.io/",
  56: "https://bscscan.com",
};

function netLink(hash, network) {
  const { NETWORK } = window.variables;
  return `${netURLs[network || NETWORK]}/tx/${hash}`;
}

const netScans = {
  1: "Etherscan",
  3: "Etherscan(ropsten)",
  3: "Etherscan(rinkeby)",
  56: "Bscscan",
};

function netScan(network) {
  const { NETWORK } = window.variables;
  return netScans[network || NETWORK];
}

window.services = {
  key: "swipe-swap",
  mounter: ".js-popup-open[href='#connect_wallet']",
  mounted: false,
  watch: null,
  tick: 5 * 1000,
  expire: 10 * 60 * 1000,
  toastExpire: 10,
  themes: ["light-mode", "dark-mode"],
  storage: defaults,
  importSuggest: {},
  load() {
    if (localStorage.getItem(this.key))
      this.storage = JSON.parse(localStorage.getItem(this.key));
    this.loadTheme();
    this.watch = setInterval(() => {
      this.checkTransactions();
    }, this.tick);
    this.updateToasts();
    this.loadImports();

    $(document).on("click", "#toasts .btn", function () {
      const href = $(this).data("href");
      if (href) window.open(href);
      $(this).remove();
    });
  },
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.storage));
    this.updateToasts();
  },
  get transactions() {
    const { NETWORK } = window.variables;
    if (!NETWORK) return [];
    return this.storage.transactions.filter(
      ({ network = 3 }) => network === NETWORK
    );
  },
  set transactions(receipts) {
    const hashes = receipts.map((item) => item.transactionHash);
    this.storage.transactions = this.transactions.map((item) => {
      const updated = hashes.includes(item.hash);
      if (updated) {
        const receipt = receipts.find(
          (receipt) => receipt.transactionHash === item.hash
        );
        this.toast({
          id: item.id,
          text: item.text,
          link: netLink(item.hash),
          status: receipt.status,
        });
        return {
          ...item,
          receipt,
        };
      }
      return item;
    });
    this.save();
    this.checkPending();
  },
  get pendingTransaction() {
    const timestamp = Date.now();
    return this.transactions.filter(
      ({ receipt, expireAt }) => !receipt && expireAt && expireAt > timestamp
    );
  },
  updateToasts() {
    if (!this.pendingTransaction.length && this.transactions.length) {
      $("#toasts .count .value").html(this.transactions.length);
      $("#toasts .count").show();
    } else {
      $("#toasts .count").hide();
    }
    const transactions = $(".transactions");
    if (this.transactions.length) {
      transactions.find(".transactions__description").hide();
      transactions.find("#clear-all").show();
      const items = transactions.find(".transactions__items");
      transactions.find(".transactions__items").show();
      items.html("");
      this.transactions.forEach(({ text, hash, receipt, network = 3 }) =>
        items.append(`
        <a href="${netLink(hash, network)}" target="_blank">
          ${text} <img src="/images/icons/${receipt ? (receipt.status ? "completed" : "failed") : "loading"
          }.svg" />
        </a>
      `)
      );
    } else {
      transactions.find(".transactions__description").show();
      transactions.find("#clear-all").hide();
      transactions.find(".transactions__items").hide();
    }
  },
  checkTransactions() {
    if (!web3 || !this.pendingTransaction.length) return;
    Promise.all(
      this.pendingTransaction.map(({ hash }) =>
        web3.eth.getTransactionReceipt(hash)
      )
    )
      .then((transactions) => {
        this.transactions = transactions.filter((item) => !!item);
      })
      .catch(console.log);
  },
  checkSupported() {
    const { NETWORK } = window.variables;
    if (NETWORK) {
      // if (!isETH) {
      //   $('a[href="farm.html"]').hide();
      // } else {
      //   $('a[href="farm.html"]').show();
      // }
      if (window.isETH === undefined) return;
      $(`.swap-toggle__btn:nth-child(${isETH ? 2 : 1}) input`).removeAttr('checked');
      $(`.swap-toggle__btn:nth-child(${isETH ? 1 : 2}) input`).attr('checked', 'checked');
      const base = $(".base-token");
      base.find(".ticker").text(BASE_SYMBOL);
      base.find(".descr").text(BASE_ASSET);
      base.find("img").attr("src", BASE_LOGO);
      if (SUPPORTED_NETWORKS.includes(NETWORK)) {
        $("#toasts .btn").remove();
        this.pendingTransaction.length > 0 && $("#toasts .count").show();
        this.checkPending();
      } else {
        $("#toasts .count").hide();
        $("#toasts .btn").remove();
        $("#toasts").append(`
        <button class="btn btn-gray ease-in">
          You are connected to ${networkLabels[NETWORK] + (networkSuffix[NETWORK] || "")
          }<br>
          <span>Our supported networks are ${SUPPORTED_NETWORKS.map(
            (network, index) => {
              const label = `<b>${networkLabels[network]}</b>`;
              return index === SUPPORTED_NETWORKS.length - 1
                ? `and ${label}`
                : label;
            }
          ).join(", ")}</span>
        </button>
      `);
      }
    }
  },
  checkPending() {
    const { NETWORK } = window.variables;
    if (NETWORK) {
      const pending = this.pendingTransaction.length;
      if (pending) {
        this.mount(pending);
      } else {
        this.unMount();
        this.updateToasts();
      }
    }
  },
  mount(count) {
    if (!this.mounted) {
      const mount = $(this.mounter);
      mount.css("position", "relative");
      mount.append(`
        <a href="#transactions" class="services-mounted js-popup-open">${count} pending</a>
      `);
      this.mounted = true;
    } else {
      $(".connect-btn a[href='#transactions']").text(`${count} pending`);
    }
  },
  unMount() {
    const mount = $(this.mounter);
    mount.find("[href='#transactions']").remove();
    this.mounted = false;
  },
  clear() {
    this.storage.transactions = [];
    this.save();
  },
  push(transaction) {
    const { NETWORK } = window.variables;
    const timestamp = Date.now();
    this.storage.transactions.unshift({
      ...transaction,
      id: timestamp.toString(),
      expireAt: Date.now() + this.expire,
      network: NETWORK,
    });
    this.save();
    this.checkPending();
  },
  update(receipt) {
    this.transactions = [receipt];
  },
  toast({ id, text, link, status }) {
    const container = $("#toasts");
    container.append(`
      <button class="btn btn-${status ? "lbiege" : "gray"
      }" data-href="${link}" id="tx-${id}">
        ${text} (<span>${status ? "Completed" : "Failed"}</span>)
      </button>
    `);
    setTimeout(() => $(`#tx-${id}`).addClass("ease-in"), 0.5 * 1000);
    setTimeout(
      () => $(`#tx-${id}`).removeClass("ease-in").addClass("ease-out"),
      this.toastExpire * 1000
    );
    setTimeout(() => $(`#tx-${id}`).remove(), (this.toastExpire + 0.5) * 1000);
  },
  toggleTheme() {
    const { theme: origin = 0 } = this.storage;
    $(document.body).removeClass(this.themes[origin]);
    this.storage.theme = (origin + 1) % this.themes.length;
    this.loadTheme();
    this.save();
  },
  loadTheme() {
    const { theme = 0 } = this.storage;
    $(".dark-mode-toggle input").attr("checked", theme === 1);
    $(document.body).addClass(this.themes[theme]);
  },
  tokenSuggest(token) {
    const id = `suggest-import-${token.address}`;
    if (this.importSuggest[id]) return;
    this.importSuggest[id] = token;
    $(".token-list").append(`
      <a class="token-list__item js-select-token" href="#" data-key="${token.address}"><img src="${token.logoURI}" alt="${token.name}">
        <div class="token-list__item-name">
          <div class="ticker">${token.symbol}</div>
          <div class="descr">${token.name}</div>
          <div class="hidden">${token.address}</div>
          <button class="btn btn-lbiege" id=${id}>Import</button>
        </div>
      </a>
    `);

    if (token.logoURI === 'images/swap/error.svg') {
      $(".swap-form-import__notice").show();
      $(".swap-form-import__notice").html(`
        <img src="images/swap/error.svg" alt="${token.name}" />
        <h6>Trade at your own risk!</h6>
        <p>Anyone can create a token, including creating fake versions of existing tokens that claim to represent projects.</p>
        <p>If you purchase this token, you may not be able to sell it back.</p>
      `);
    } else {
      $(".swap-form-import__notice").hide();
    }

    $(`#${id}`).on('click', function (e) {
      e.stopPropagation();
      services.importToken(this);
    });
    registerToken(token);
  },
  importToken(elem) {
    const token = this.importSuggest[elem.id];
    const { NETWORK } = window.variables;
    const { imports = {} } = this.storage;
    if (imports[NETWORK]) {
      imports[NETWORK].push(token);
    } else {
      imports[NETWORK] = [token];
    }
    this.storage.imports = imports;
    this.save();
    $(elem).remove();
  },
  loadImports() {
    const { TOKEN_LIST } = window.variables;
    delete this.storage.imports; this.save();
    const { imports = {} } = this.storage;
    Object.keys(imports).forEach(network => {
      TOKEN_LIST[network].push(...imports[network]);
    });
    $(".swap-form-import__notice").hide();
  }
};

window.events.load = function load() {
  services.load();

  $(document).on("click", "[data-service-click]", function (e) {
    const [key, params = ""] = getTargetEvent(e, "data-service-click");
    if (services[key]) services[key](e, ...params.split(","));
  });

  $(document).on("click", ".swap-toggle__btn", function (e) {
    e.preventDefault();
    const { NETWORK } = window.variables;
    let request = 1;
    switch ($(this).find('span').text()) {
      case 'Binance': request = 56; break;
      default: break;
    }
    if (NETWORK !== request) {
      changeNetworkRequest(request);
    }
  });
};

window.events.checkSupported = function checkSupported() {
  services.checkSupported();
};

window.triggers.onLoad = [...(window.triggers.onLoad || []), "load"];
window.triggers.networkChanged = [
  ...(window.triggers.networkChanged || []),
  "checkSupported",
];
