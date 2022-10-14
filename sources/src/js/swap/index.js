"use strict";

var SIDES = {
  from: "to",
  to: "from",
};

var pairList = [];
var pairMap = {};
var midToken = null;

var SETTINGS = {
  slippage: 0.5,
  deadline: 20,
};

window.onload = function () {
  window.triggers.selectAccount = [...(window.triggers.selectAccount || []), "init"];
  window.events.init = init;
  window.events.onSelectToken = onSelectToken;
  window.events.onInputAmount = onInputAmount;
  window.events.onConfirmSwap = onConfirmSwap;
  window.events.onModalClose = onModalClose;
  window.events.onWrap = onWrap;
  window.events.onUnwrap = onUnwrap;
  window.events.onBalance = onBalance;
  window.events.onInputDeadline = onInputDeadline;

  $(document).on("click", ".swap-approve-btn", function (e) {
    e.preventDefault();
    handleApprove();
  });

  $(document).on("click", ".swap-form__settings-slippage-values-item", function (e) {
    e.preventDefault();
    $(".swap-form__settings-slippage-values-item").removeClass("active");
    $(this).addClass("active");
    SETTINGS.slippage = parseFloat($(this).text().slice(0, -1));
    if (TOKENS.to && TOKENS.to.amount) {
      $(".swap-footer").find("#swap-min-received").html(`
          ${TOKENS.to.amount
            .times(100 - SETTINGS.slippage)
            .div(100)
            .dp(4, 1)
            .toString(10)} ${getTokenSymbol(TOKENS.to.token)}
        `);
    }
  });
};

function validAddr(address) {
  const { ZERO, WETH } = window.variables;
  return address === ZERO ? WETH : address;
}

function joinAddr(...addresses) {
  return addresses
    .map(validAddr)
    .map((addr) => addr.toLowerCase())
    .join("-");
}

function uniquePair(addr1, addr2) {
  const addresses = [validAddr(addr1).toLowerCase(), validAddr(addr2).toLowerCase()];
  const isFirst = addresses[0] < addresses[1];
  if (!isFirst) addresses.reverse();
  return [addresses.join("-"), isFirst];
}

function sellPrice(input, [reserve0, reserve1]) {
  const numerator = new BigNumber(input).times(new BigNumber(reserve1)).times(997);
  const denominator = new BigNumber(reserve0).times(1000).plus(input.times(997));
  return numerator.div(denominator);
}

function buyPrice(output, [reserve1, reserve0]) {
  const numerator = new BigNumber(output).times(new BigNumber(reserve0)).times(1000);
  const denominator = new BigNumber(reserve1).minus(new BigNumber(output)).times(997);
  return numerator.div(denominator);
}

function getOrderPrice(amount, baseToken, pairs, isSell) {
  if (pairs.length === 0) return [new BigNumber(amount), 0, []];
  const orderPrice = isSell ? buyPrice : sellPrice;
  return (isSell ? [...pairs].reverse() : pairs).reduce(
    ([[amount, impact, route], base], pair) => {
      const isBase = base === pair.token1.id;
      const basePrice = new BigNumber(isBase ? pair.token0Price : pair.token1Price);
      const reserves = isBase ? [pair.reserve1, pair.reserve0] : [pair.reserve0, pair.reserve1];
      const output = orderPrice(amount, reserves);
      const tokenImpact = basePrice.minus(output.div(amount)).div(basePrice).times(100).toNumber();
      // console.log(`${pair.token0.symbol}-${pair.token1.symbol}`, amount.toNumber(), output.toNumber(), tokenImpact);
      return [
        [
          output,
          Math.abs((impact > 0 ? impact : 1) * tokenImpact),
          [...route, uniquePair(pair.token0.id, pair.token1.id)[0]],
        ],
        isBase ? pair.token0.id : pair.token1.id,
      ];
    },
    [[new BigNumber(amount), 0, []], baseToken]
  )[0];
}

function checkValid() {
  const button = $(".swap-btn");
  const { ACCOUNT, ZERO, WETH } = window.variables;
  if (!ACCOUNT) {
    $(button).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    return;
  }

  const from = $(".swap-form__input-row[data-input='from']");
  const to = $(".swap-form__input-row[data-input='to']");

  const fromKey = getData(from.find("a.selected"));
  const toKey = getData(to.find("a.selected"));
  if (!fromKey || !toKey) {
    $(button).html(`<button class="btn btn-big btn-disabled">Select a token</button>`);
    return;
  }

  const fromToken = TOKENS.from;
  const toToken = TOKENS.to;
  if (!fromToken.isApproved) {
    $(button).html(`<button class="btn btn-big swap-approve-btn">Approve ${fromToken.token.symbol}</button>`);
    return;
  }

  const fromAmount = from.find("input").val();
  const toAmount = to.find("input").val();
  if (!fromAmount || !toAmount) {
    $(button).html(`<button class="btn btn-big btn-disabled">Enter an amount</button>`);
    return;
  }

  if (new BigNumber(fromAmount).gt(fromToken.balance)) {
    $(button).html(`<button class="btn btn-big btn-disabled">Insufficient balance</button>`);
    return;
  }

  if (fromToken.token.address === ZERO && toToken.token.address === WETH) {
    $(button).html(`<button class="btn btn-big btn-swap-wrap" data-event-click="onWrap">Wrap</button>`);
    return;
  }

  if (fromToken.token.address === WETH && toToken.token.address === ZERO) {
    $(button).html(`<button class="btn btn-big btn-swap-unwrap" data-event-click="onUnwrap">Unwrap</button>`);
    return;
  }

  $(button).html(`
    <button
      class="btn btn-big js-popup-open"
      href="#confirm_swap"
      data-from-symbol="${getTokenSymbol(TOKENS.from.token)}"
      data-from-amount="${TOKENS.from.amount.dp(6, 1).toString(10)}"
      data-to-symbol="${getTokenSymbol(TOKENS.to.token)}"
      data-to-amount="${TOKENS.to.amount.dp(6, 1).toString(10)}"
    >
      Swap
    </button>
  `);
}

function updateToken(side) {
  const { balance } = TOKENS[side];
  $(`#balance-${side} span`).text(balance.dp(2, 1).toNumber());
}

var refreshTimer = null;
async function init() {
  const { ACCOUNT } = window.variables;
  if (ACCOUNT) {
    const [balance, isApproved, token] = await getTokenInfo();
    TOKENS.from = { balance, isApproved, token, amount: new BigNumber(0) };
    updateToken("from");
  }
  if (refreshTimer) clearInterval(refreshTimer);
  refreshPairs(true);
  setInterval(() => refreshPairs(), 60 * 1000);
}

function refreshPairs(init = false) {
  getFullPairs().then((res) => {
    pairList = res;
    pairMap = res.reduce(
      (map, pair) => {
        const [id] = uniquePair(pair.token0.id, pair.token1.id);
        const addresses = id.split("-");
        map[id] = pair;
        map.pairs[addresses[0]] = [...(map.pairs[addresses[0]] || []), addresses[1]];
        map.pairs[addresses[1]] = [...(map.pairs[addresses[1]] || []), pair.token0.id];
        return map;
      },
      {
        pairs: {},
        routes: {},
        getRoute(addresses, amount, isSell = false) {
          const [addr1, addr2] = joinAddr(...addresses).split("-");
          if (addr1 === addr2) return [[addr1, getOrderPrice(amount, addr1, [])]];
          let candidates = [];
          {
            const [id] = uniquePair(addr1, addr2);
            if (this[id]) {
              candidates.push([id, getOrderPrice(amount, isSell ? addr2 : addr1, [this[id]], isSell)]);
            }
            if (this.pairs[addr1]) {
              let firsts = this.pairs[addr1].filter((first) => this.pairs[first].includes(addr2));
              firsts.forEach((first) => {
                const [pair1] = uniquePair(addr1, first);
                const [pair2] = uniquePair(first, addr2);
                if (!this[pair1] || !this[pair2]) return;
                const route = joinAddr(addr1, first, addr2);
                candidates.push([
                  route,
                  getOrderPrice(amount, isSell ? addr2 : addr1, [this[pair1], this[pair2]], isSell),
                ]);
              });

              firsts = this.pairs[addr1].filter((first) => !this.pairs[first].includes(addr2));
              firsts.forEach((first) => {
                const seconds = this.pairs[first].filter((second) => this.pairs[second].includes(addr2));
                seconds.forEach((second) => {
                  const [pair1] = uniquePair(addr1, first);
                  const [pair2] = uniquePair(first, second);
                  const [pair3] = uniquePair(second, addr2);
                  if (!this[pair2] || !this[pair3]) return;
                  const route = joinAddr(addr1, first, second, addr2);
                  candidates.push([
                    route,
                    getOrderPrice(amount, isSell ? addr2 : addr1, [this[pair1], this[pair2], this[pair3]], isSell),
                  ]);
                });
              });
            }
          }
          candidates = candidates
            .filter((c) => c[1][0].toNumber() > 0)
            .sort((a, b) => (b[1][0].toNumber() - a[1][0].toNumber()) * (isSell ? -1 : 1));
          return candidates;
        },
      }
    );
    init && checkValid();
  });
}

async function onSelectToken(side, address) {
  const { ACCOUNT } = window.variables;
  if (side) {
    if (ACCOUNT) {
      const [balance, isApproved, token] = await getTokenInfo(address);
      TOKENS[side] = {
        amount: TOKENS[side].amount,
        balance,
        isApproved,
        token,
      };
      $(`#balance-${side} span`).text(balance.dp(2, 1).toNumber());
      onInputAmount(null, side);
      return;
    }
  }
  $("#balance-to span").text(TOKENS.from.balance ? TOKENS.from.balance.dp(2, 1).toNumber() : "-");
  $("#balance-from span").text(TOKENS.to.balance ? TOKENS.to.balance.dp(2, 1).toNumber() : "-");
  clear();
  checkValid();
}

async function onInputAmount(e, side) {
  let amount = TOKENS[side].amount;
  if (e) {
    amount = new BigNumber(e.target.value || "0");
    TOKENS[side] = {
      ...TOKENS[side],
      amount,
    };
  }
  const form = $(".swap-form");
  if (amount && !amount.isZero() && TOKENS.to.token && TOKENS.from.token) {
    const [bestRoute] = pairMap.getRoute([TOKENS.from.token.address, TOKENS.to.token.address], amount, side === "to");
    if (!bestRoute) {
      $(".swap-btn").html(`<button class="btn btn-big btn-disabled">Insufficient liquidity for this trade</button>`);
      return;
    }
    const [path, [outAmount, priceImpact, route]] = bestRoute;
    const swapPriceImpact = $(".swap-footer").find("#swap-price-impact");
    swapPriceImpact
      .removeClass("green")
      .removeClass("red")
      .addClass(priceImpact > 10 ? "red" : priceImpact < 2.5 ? "green" : "normal");
    swapPriceImpact.html(`${new BigNumber(priceImpact).dp(2, 1).toString(10)} %`);

    // $("#swap-footer-route").show();
    const { TOKEN_LIST, NETWORK } = window.variables;
    const tokens = TOKEN_LIST[NETWORK];
    $("#swap-best-route").html(
      path
        .split("-")
        .map((item) => tokens.find((token) => token.address.toLowerCase() === item))
        .map((token) => `<img src="${token.logoURI}"/>` + token.symbol)
        .join(" > ")
    );
    if (route.length > 1) midToken = toChecksumAddress(path.split("-")[1]);
    else midToken = null;

    TOKENS[SIDES[side]] = {
      ...TOKENS[SIDES[side]],
      amount: outAmount,
    };
    form
      .find(`[data-input="${SIDES[side]}"]`)
      .find("input")
      .val(outAmount.dp(TOKENS[SIDES[side]].token.decimals || 18, 1).toString());

    const { ZERO, WETH } = window.variables;
    if (
      (TOKENS.from.token.address === ZERO && TOKENS.to.token.address === WETH) ||
      (TOKENS.from.token.address === WETH && TOKENS.to.token.address === ZERO)
    ) {
      checkValid();
      $(".swap-footer").hide();
      return;
    }

    $(".swap-form__price").html(`
      <div class="swap-form__price-content">
        <div class="swap-form__price-content-label">Price</div>
        <div class="swap-form__price-content-value">
          ${(side === "to" ? amount : outAmount)
            .div(side === "to" ? outAmount : amount)
            .dp(4, 1)
            .toString(10)} ${getTokenSymbol(TOKENS.to.token)} per ${getTokenSymbol(TOKENS.from.token)}
        </div>
      </div>
    `);
    $(".swap-footer").show();
    $(".swap-footer").find("#swap-min-received").html(`
        ${TOKENS.to.amount
          .times(100 - SETTINGS.slippage)
          .div(100)
          .dp(4, 1)
          .toString(10)} ${getTokenSymbol(TOKENS.to.token)}
      `);
    $(".swap-footer")
      .find("#swap-lp-fee")
      .html(
        `${TOKENS.from.amount
          .times(0.003)
          .dp((TOKENS.from.token.decimals || 18) - 2, 1)
          .toString(10)} ${getTokenSymbol(TOKENS.from.token)}`
      );
  } else {
    // clear();
  }
  checkValid();
}

function clear() {
  $("#swap-from-token").val("");
  $("#swap-to-token").val("");
  $(".swap-form__price").empty();
  $(".swap-footer").hide();
  checkValid();
}

function handleApprove() {
  $(".swap-approve-btn").addClass("btn-disabled");
  $(".swap-approve-btn").text("Approving...");
  const { ACCOUNT, CONTRACT_ERC20_ABI } = window.variables;
  const tokenContract = new web3.eth.Contract(CONTRACT_ERC20_ABI, TOKENS.from.token.address);

  send(tokenContract.methods.approve)(
    window.variables.CONTRACT_ROUTER_ADDRESS,
    new BigNumber(2).pow(256).minus(1).toString(10),
    { from: ACCOUNT }
  )
    .send()
    .on("transactionHash", (hash) => {
      services.push({ text: `Approve ${TOKENS.from.token.symbol}`, hash });
    })
    .on("receipt", (receipt) => {
      TOKENS.from = { ...TOKENS.from, isApproved: true };
      checkValid();
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      $(".swap-approve-btn").removeClass("btn-disabled");
      $(".swap-approve-btn").text(`Approve ${TOKENS.from.token.symbol}`);
      if (receipt) services.update(receipt);
    });
}

async function onWrap() {
  $(".btn-swap-wrap").addClass("btn-disabled");
  $(".btn-swap-wrap").text("Wrapping...");
  const { ACCOUNT, CONTRACT_WETH_ABI, WETH } = window.variables;
  const tokenContract = new web3.eth.Contract(CONTRACT_WETH_ABI, WETH);

  const encodedABI = tokenContract.methods.deposit().encodeABI();

  const tx = {
    from: ACCOUNT,
    to: WETH,
    gasPrice: window.web3.utils.toHex(await window.web3.eth.getGasPrice()),
    data: encodedABI,
    value: `0x${toWei(TOKENS.from.amount).toString(16)}`,
  };
  window.web3.eth
    .sendTransaction(tx)
    .on("transactionHash", (hash) => {
      console.log("hash :>> ", hash);
      $(".btn-swap-wrap").removeClass("btn-disabled");
      $(".btn-swap-wrap").text(`Wrap`);
      handleTransactionSuccess(hash);
      services.push({
        text: `Wrap ${BASE_SYMBOL} for ${TOKENS.from.amount.toFixed(4)} W${BASE_SYMBOL}`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("err :>> ", err);
      $(".btn-swap-wrap").removeClass("btn-disabled");
      $(".btn-swap-wrap").text(`Wrap`);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
}

async function onUnwrap() {
  $(".btn-swap-unwrap").addClass("btn-disabled");
  $(".btn-swap-unwrap").text("Unwrapping...");
  const { ACCOUNT, CONTRACT_WETH_ABI, WETH } = window.variables;
  const tokenContract = new web3.eth.Contract(CONTRACT_WETH_ABI, WETH);

  const encodedABI = tokenContract.methods.withdraw(`0x${toWei(TOKENS.from.amount).toString(16)}`).encodeABI();

  const tx = {
    from: ACCOUNT,
    to: WETH,
    gasPrice: window.web3.utils.toHex(await window.web3.eth.getGasPrice()),
    data: encodedABI,
    value: `0x0`,
  };
  window.web3.eth
    .sendTransaction(tx)
    .on("transactionHash", (hash) => {
      console.log("hash :>> ", hash);
      $(".btn-swap-unwrap").removeClass("btn-disabled");
      $(".btn-swap-unwrap").text(`Unwrap`);
      handleTransactionSuccess(hash);
      services.push({
        text: `Unwrap W${BASE_SYMBOL} for ${TOKENS.from.amount.toFixed(4)} ${BASE_SYMBOL}`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      console.log("receipt :>> ", receipt);
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("err :>> ", err);
      $(".btn-swap-unwrap").removeClass("btn-disabled");
      $(".btn-swap-unwrap").text(`Unwrap`);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
}

function getTokenSymbol(token) {
  return token.address === window.variables.ZERO ? BASE_SYMBOL : token.symbol;
}

async function onConfirmSwap() {
  const { from: fromToken, to: toToken } = TOKENS;
  $(".popup-overlay#confirm_swap").fadeOut(200);
  $(".popup-overlay#pending_transaction").fadeIn(200);
  $(".popup__pending-details-info").text(`
    Swapping ${fromToken.amount.dp(6, 1).toString(10)} ${getTokenSymbol(fromToken.token)} for ${toToken.amount
    .dp(6, 1)
    .toString(10)} ${getTokenSymbol(toToken.token)}
  `);

  const { ACCOUNT, ROUTER_CONTRACT, CONTRACT_ROUTER_ADDRESS, ZERO, WETH } = window.variables;
  const blockInfo = await getBlockInfo();

  if ([fromToken.token.address, toToken.token.address].includes(ZERO)) {
    if (fromToken.token.address === ZERO) {
      // swap eth for erc20
      const encodedABI = ROUTER_CONTRACT.methods
        .swapExactETHForTokensSupportingFeeOnTransferTokens(
          `0x${toWei(toToken.amount, toToken.token.decimals)
            .times(100 - SETTINGS.slippage)
            .div(100)
            .dp(0, 0)
            .toString(16)}`,
          midToken ? [WETH, midToken, toToken.token.address] : [WETH, toToken.token.address],
          ACCOUNT,
          blockInfo.timestamp + SETTINGS.deadline * 60
        )
        .encodeABI();

      const tx = {
        from: ACCOUNT,
        to: CONTRACT_ROUTER_ADDRESS,
        gasPrice: window.web3.utils.toHex(await window.web3.eth.getGasPrice()),
        data: encodedABI,
        value: `0x${toWei(fromToken.amount).toString(16)}`,
      };
      window.web3.eth
        .sendTransaction(tx)
        .on("transactionHash", (hash) => {
          handleTransactionSuccess(hash);
          services.push({
            text: `Swap ${fromToken.amount.toFixed(4)} ${BASE_SYMBOL} for ${toToken.amount.toFixed(4)} ${
              toToken.token.symbol
            }`,
            hash,
          });
        })
        .on("receipt", (receipt) => {
          console.log("transaction success");
          services.update(receipt);
        })
        .on("error", (err, receipt) => {
          console.log("err :>> ", err);
          handleTransactionError();
          if (receipt) services.update(receipt);
        });
    } else {
      // swap erc20 for eth
      const encodedABI = ROUTER_CONTRACT.methods
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          `0x${toWei(fromToken.amount, fromToken.token.decimals).dp(0, 0).toString(16)}`,
          `0x${toWei(toToken.amount)
            .times(100 - SETTINGS.slippage)
            .div(100)
            .dp(0, 0)
            .toString(16)}`,
          midToken ? [fromToken.token.address, midToken, WETH] : [fromToken.token.address, WETH],
          ACCOUNT,
          blockInfo.timestamp + SETTINGS.deadline * 60
        )
        .encodeABI();

      const tx = {
        from: ACCOUNT,
        to: CONTRACT_ROUTER_ADDRESS,
        gasPrice: window.web3.utils.toHex(await window.web3.eth.getGasPrice()),
        data: encodedABI,
        value: `0x0`,
      };
      window.web3.eth
        .sendTransaction(tx)
        .on("transactionHash", (hash) => {
          handleTransactionSuccess(hash);
          services.push({
            text: `Swap ${fromToken.amount.toFixed(4)} ${fromToken.token.symbol} for ${toToken.amount.toFixed(
              4
            )} ${BASE_SYMBOL}`,
            hash,
          });
        })
        .on("receipt", (receipt) => {
          services.update(receipt);
        })
        .on("error", (err, receipt) => {
          console.log("err :>> ", err);
          handleTransactionError();
          if (receipt) services.update(receipt);
        });
    }
  } else {
    // swap erc20 for erc20
    const encodedABI = ROUTER_CONTRACT.methods
      .swapExactTokensForTokensSupportingFeeOnTransferTokens(
        `0x${toWei(fromToken.amount, fromToken.token.decimals).dp(0, 0).toString(16)}`,
        `0x${toWei(toToken.amount, toToken.token.decimals)
          .times(100 - SETTINGS.slippage)
          .div(100)
          .dp(0, 0)
          .toString(16)}`,
        midToken
          ? [fromToken.token.address, midToken, toToken.token.address]
          : [fromToken.token.address, toToken.token.address],
        ACCOUNT,
        blockInfo.timestamp + SETTINGS.deadline * 60
      )
      .encodeABI();

    const tx = {
      from: ACCOUNT,
      to: CONTRACT_ROUTER_ADDRESS,
      gasPrice: window.web3.utils.toHex(await window.web3.eth.getGasPrice()),
      data: encodedABI,
      value: `0x0`,
    };
    window.web3.eth
      .sendTransaction(tx)
      .on("transactionHash", (hash) => {
        handleTransactionSuccess(hash);
        services.push({
          text: `Swap ${fromToken.amount.toFixed(4)} ${fromToken.token.symbol} for ${toToken.amount.toFixed(4)} ${
            toToken.token.symbol
          }`,
          hash,
        });
      })
      .on("receipt", (receipt) => {
        services.update(receipt);
      })
      .on("error", (err, receipt) => {
        console.log("err :>> ", err);
        handleTransactionError();
        if (receipt) services.update(receipt);
      });
  }
}

function onModalClose() {
  $(".popup-overlay").fadeOut(200);
}

function handleTransactionSuccess(hash) {
  $(".popup-overlay#pending_transaction").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup__transaction-img").attr("src", "images/swap/submit.svg");
  $(".popup-overlay .popup__transaction-title").text("Transaction Submitted");
  $(".popup-overlay .popup__transaction-title").after(`
    <a
      target="_blank"
      rel="noopener noreferrer"
      href="${netLink(hash)}"
      class="popup__transaction-link">
      View on ${netScan()}
    </a>
  `);
  $(".popup-overlay .popup__transaction-btn").text("Close");
  clear();
}

function handleTransactionError() {
  $(".popup-overlay#pending_transaction").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup-overlay .popup__transaction-title").text("Transaction Rejected.");
  $(".popup__transaction-img").attr("src", "images/swap/error.svg");
  $(".popup-overlay .popup__transaction-btn").text("Dismiss");
}

function onBalance(e, side) {
  const balance = $(`#balance-${side} span`).text();
  if (!isNaN(balance)) {
    const form = $(".swap-form");
    form.find(`[data-input="${side}"] input`).val(balance);
    onInputAmount({ target: { value: balance } }, side);
  }
}

function onInputDeadline(e) {
  SETTINGS.deadline = parseFloat(e.target.value || 20);
}
