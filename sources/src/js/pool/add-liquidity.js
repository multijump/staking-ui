"use strict";

var SIDES = {
  from: "to",
  to: "from",
};

var SIDE_NAMES = {
  from: "inputCurrency",
  to: "outputCurrency",
};

var TYPES = {
  create: "create",
  add: "add",
};

const DEFAULT_SLIPPAGE = 0.5;
const DEFAULT_DESDLINE = 20;

window.onload = function () {
  window.variables.liquidity = {
    SLIPPAGE: DEFAULT_SLIPPAGE,
  };
  window.triggers.selectAccount = [...(window.triggers.selectAccount || []), "init"];
  window.events.init = init;
  window.events.onSelectToken = onSelectToken;
  window.events.onInputAmount = onInputAmount;
  window.events.onBalance = onBalance;
  window.events.onApprove = onApprove;
  window.events.onConfirmSupply = onConfirmSupply;
  window.events.onModalClose = onModalClose;

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

function init() {
  const { ACCOUNT, ZERO } = window.variables;
  const inputAddr = getUrlParameter(SIDE_NAMES.from) || ZERO;
  const outputAddr = getUrlParameter(SIDE_NAMES.to);
  const type = getUrlParameter("type") || TYPES.create;
  updateUrlParameter(SIDE_NAMES.from, inputAddr);
  updateTip(type);

  if (ACCOUNT) {
    Promise.all([
      getFullPairs(),
      getTokenInfo(toChecksumAddress(inputAddr)),
      outputAddr ? getTokenInfo(toChecksumAddress(outputAddr)) : Promise.resolve([0, false, null]),
    ])
      .then(([pairs, [balance0, isApproved0, token0], [balance1, isApproved1, token1]]) => {
        TOKENS.from = {
          balance: balance0,
          isApproved: isApproved0,
          token: token0,
          amount: new BigNumber(0),
        };
        updateToken("from");

        TOKENS.to = token1
          ? {
              balance: balance1,
              isApproved: isApproved1,
              token: token1,
              amount: new BigNumber(0),
            }
          : null;

        if (TOKENS.to) {
          updateToken("to");
        }
        window.variables.liquidity.PAIRS = pairs;
        checkValid();
      })
      .catch(console.log);
  } else {
    checkValid();
  }
}

function onSelectToken(side, address) {
  const { ACCOUNT } = window.variables;

  if (side && ACCOUNT) {
    getTokenInfo(address)
      .then(([balance, isApproved, token]) => {
        updateUrlParameter(SIDE_NAMES[side], address);
        TOKENS[side] = {
          amount: 0,
          balance,
          isApproved,
          token,
        };
        $(`#balance-${side} span`).text(balance.dp(2, 1).toNumber());
        onInputAmount(null, side);
      })
      .catch(console.log);
  } else {
    $("#balance-to span").text(TOKENS.from.balance ? TOKENS.from.balance.dp(2, 1).toNumber() : "-");
    $("#balance-from span").text(TOKENS.to.balance ? TOKENS.to.balance.dp(2, 1).toNumber() : "-");
  }
  checkValid();
}

function onInputAmount(e, side) {
  let amount = TOKENS[side]?.amount;

  if (e) {
    amount = new BigNumber(e.target.value || "0");
    TOKENS[side] = {
      ...TOKENS[side],
      amount,
    };
  }
  const form = $(".swap-form");
  const {
    ACCOUNT,
    ZERO,
    WETH,
    liquidity: { PAIRS },
  } = window.variables;
  if (TOKENS.to && TOKENS.to.token && TOKENS.from && TOKENS.from.token) {
    if (
      (TOKENS.from.token.address === ZERO && TOKENS.to.token.address === WETH) ||
      (TOKENS.from.token.address === WETH && TOKENS.to.token.address === ZERO)
    ) {
      checkValid();
      return;
    }
    let sharePercent = new BigNumber(0);

    if (PAIRS) {
      const token0 = TOKENS.from.token;
      const token1 = TOKENS.to.token;

      let pair = PAIRS.find((p) => {
        return (
          (toChecksumAddress(p.token0.id) == toChecksumAddress(token0.address) ||
            (toChecksumAddress(p.token0.id) == toChecksumAddress(WETH) && toChecksumAddress(token0.address) == ZERO)) &&
          (toChecksumAddress(p.token1.id) == toChecksumAddress(token1.address) ||
            (toChecksumAddress(p.token1.id) == WETH && toChecksumAddress(token1.address) == ZERO))
        );
      });

      let isPairReversed = false;
      if (!pair) {
        pair = PAIRS.find((p) => {
          return (
            (toChecksumAddress(p.token0.id) == toChecksumAddress(token1.address) ||
              (toChecksumAddress(p.token0.id) == toChecksumAddress(WETH) &&
                toChecksumAddress(token1.address) == ZERO)) &&
            (toChecksumAddress(p.token1.id) == toChecksumAddress(token0.address) ||
              (toChecksumAddress(p.token1.id) == WETH && toChecksumAddress(token0.address) == ZERO))
          );
        });

        if (pair) {
          isPairReversed = true;
        }
      }

      if (pair) {
        updateTip(TYPES.add);
        window.variables.liquidity.SELECTED_PAIR = pair;
        const selectedPairContract = getPairTokenContract(pair.id);
        const { reserve0, reserve1, token0Price, token1Price } = pair;
        let reserves = [reserve0, reserve1];

        if (isPairReversed) {
          reserves.reverse();
        }

        if (side == "to") {
          reserves.reverse();
        }

        Promise.all([getQuote(amount, reserves[0], reserves[1]), getBalance(ACCOUNT, selectedPairContract)])
          .then(([quote, [balance]]) => {
            TOKENS[SIDES[side]] = {
              ...TOKENS[SIDES[side]],
              amount: quote,
            };

            if (quote) {
              form.find(`[data-input="${SIDES[side]}"]`).find("input").val(quote.toString(10));
            }

            const fromRate =
              side == "from"
                ? amount && quote
                  ? quote.dividedBy(amount)
                  : new BigNumber(token0Price)
                : amount && quote
                ? amount.dividedBy(quote)
                : new BigNumber(token1Price);
            const toRate =
              side == "from"
                ? amount && quote
                  ? amount.dividedBy(quote)
                  : new BigNumber(token1Price)
                : amount && quote
                ? quote.dividedBy(amount)
                : new BigNumber(token0Price);
            const newReserve = new BigNumber(amount).plus(reserves[0]).abs();
            sharePercent = new BigNumber(amount).div(newReserve);
            let poolShare = fromWei(new BigNumber(balance)).div(pair.totalSupply).toNumber();

            if (
              (TOKENS.from.token.address === ZERO && TOKENS.to.token.address === WETH) ||
              (TOKENS.from.token.address === WETH && TOKENS.to.token.address === ZERO)
            ) {
              checkValid();
              return;
            }

            window.variables.liquidity.FROM_RATE = fromRate;
            window.variables.liquidity.TO_RATE = toRate;
            window.variables.liquidity.SHARE_PERCENT = sharePercent;

            updatePoolShare(fromRate, toRate, sharePercent);
            $(".swap-footer").html(`
              <div class="swap-footer-content">
                <div class="swap-footer-content-title">Your position</div>
                <div class="swap-footer-content-body"> 
                  <div class="swap-footer-content-body-item"> 
                    <div class="swap-footer-content-body-item-label">
                      <div class="swap-footer-content-body-item-label-images">
                        <img src="${
                          (TOKENS.from.token.address == ZERO ? BASE_LOGO : TOKENS.from.token.logoURI) ||
                          "images/default.svg"
                        }">
                        <img src="${
                          (TOKENS.to.token.address == ZERO ? BASE_LOGO : TOKENS.to.token.logoURI) ||
                          "images/default.svg"
                        }">
                      </div>
                      <div class="swap-footer-content-body-item-label-text">${token0.symbol} / ${token1.symbol}</div>
                    </div>
                    <div class="swap-footer-content-body-item-value">${convertFromWei(balance, 18)}</div>
                  </div>
                  <div class="swap-footer-content-body-item"> 
                    <div class="swap-footer-content-body-item-label">Your pool share:</div>
                    <div class="swap-footer-content-body-item-value">${new BigNumber(poolShare * 100).toFormat(
                      2
                    )}%</div>
                  </div>
                  <div class="swap-footer-content-body-item"> 
                    <div class="swap-footer-content-body-item-label">${token0.symbol}</div>
                    <div class="swap-footer-content-body-item-value">${new BigNumber(pair.reserve0)
                      .times(poolShare)
                      .toFormat(5)}</div>
                  </div>
                  <div class="swap-footer-content-body-item"> 
                    <div class="swap-footer-content-body-item-label">${token1.symbol}</div>
                    <div class="swap-footer-content-body-item-value">${new BigNumber(pair.reserve1)
                      .times(poolShare)
                      .toFormat(5)}</div>
                  </div>
                </div>
              </div>
            `);
            checkValid();
          })
          .catch(console.log);
      } else {
        updateTip(TYPES.create, true);
        $(".swap-footer").empty();

        if (TOKENS.from.amount && !TOKENS.from.amount.isZero() && TOKENS.to.amount && !TOKENS.to.amount.isZero()) {
          const fromRate = TOKENS.to.amount.div(TOKENS.from.amount);
          const toRate = TOKENS.from.amount.div(TOKENS.to.amount);
          sharePercent = new BigNumber(100);

          window.variables.liquidity.FROM_RATE = fromRate;
          window.variables.liquidity.TO_RATE = toRate;
          window.variables.liquidity.SHARE_PERCENT = sharePercent;

          updatePoolShare(fromRate, toRate, sharePercent);
        } else {
          updatePoolShare(null, null, sharePercent);
        }

        checkValid();
      }
    } else {
      clear();
    }
  }
}

function clear() {
  $("#swap-from-token").val("");
  $("#swap-to-token").val("");
  $(".swap-form__pool-share").empty();
  $(".swap-footer").empty();
  checkValid();
}

function checkValid() {
  const button = $(".btn-add-liquidity");
  const { ACCOUNT, ZERO } = window.variables;
  if (!ACCOUNT) {
    $(button).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    return;
  }

  const from = $(".swap-form__input-row[data-input='from']");
  const to = $(".swap-form__input-row[data-input='to']");

  const fromKey = getData(from.find("a.selected"));
  const toKey = getData(to.find("a.selected"));
  if (!fromKey || !toKey) {
    $(button).html(`<button class="btn btn-big btn-disabled" href="#" data-key="1">Select a token</button>`);
    return;
  }

  const fromToken = TOKENS.from;
  const toToken = TOKENS.to;
  if (fromToken && !fromToken.isApproved && fromToken.token) {
    $(button).html(
      `<button class="btn btn-big swap-approve-btn" href="#" data-key="2"
        data-event-click="onApprove:from"
        >Approve ${fromToken.token.symbol}</button>`
    );
    return;
  }

  if (toToken && !toToken.isApproved && toToken.token) {
    $(button).html(
      `<button class="btn btn-big swap-approve-btn" href="#" data-key="3"
      data-event-click="onApprove:to"
      >Approve ${toToken.token.symbol}</button>`
    );
    return;
  }

  const fromAmount = from.find("input").val();
  const toAmount = to.find("input").val();
  if (!fromAmount || !toAmount || Number(fromAmount) == 0 || Number(toAmount) == 0) {
    $(button).html(`<button class="btn btn-big btn-disabled" href="#" data-key="4">Enter an amount</button>`);
    return;
  }

  if (new BigNumber(fromAmount).gt(0) && new BigNumber(fromAmount).gt(fromToken.balance)) {
    $(button).html(
      `<button class="btn btn-big btn-disabled" href="#" data-key="5">Insufficient ${fromToken.token.symbol} balance</button>`
    );
    return;
  }

  if (new BigNumber(toAmount).gt(0) && new BigNumber(toAmount).gt(toToken.balance)) {
    $(button).html(
      `<button class="btn btn-big btn-disabled" href="#" data-key="6">Insufficient ${toToken.token.symbol} balance</button>`
    );
    return;
  }

  const { FROM_RATE, TO_RATE, SHARE_PERCENT, SELECTED_PAIR } = window.variables.liquidity;

  let receiveValue = 0;
  if (SELECTED_PAIR) {
    const totalSupply = SELECTED_PAIR.totalSupply;
    const reserve0 = SELECTED_PAIR.reserve0;
    const reserve1 = SELECTED_PAIR.reserve1;
    receiveValue =
      totalSupply > 0
        ? Math.min(
            TOKENS.from.amount.times(totalSupply).div(reserve0).toNumber(),
            TOKENS.to.amount.times(totalSupply).div(reserve1).toNumber()
          )
        : Math.min(Math.sqrt(TOKENS.from.amount.times(TOKENS.to.amount).toNumber()));
  }

  $(button).html(`
    <button
      class="btn btn-big js-popup-open"
      href="#confirm_supply"
      data-title="${SELECTED_PAIR ? "You will receive" : "You are creating pool"}"
      data-value="${
        SELECTED_PAIR
          ? new BigNumber(receiveValue).toFormat(4)
          : TOKENS.from.token.symbol + " / " + TOKENS.to.token.symbol
      }"
      data-from-symbol="${getTokenSymbol(TOKENS.from.token)}"
      data-from-amount="${TOKENS.from.amount.dp(6, 1).toString(10)}"
      data-from-rate="${FROM_RATE.dp(6, 1).toString(10)}"
      data-from-logo="${TOKENS.from.token.address == ZERO ? BASE_LOGO : TOKENS.from.token.logoURI}"
      data-to-symbol="${getTokenSymbol(TOKENS.to.token)}"
      data-to-amount="${TOKENS.to.amount.dp(6, 1).toString(10)}"
      data-to-rate="${TO_RATE.dp(6, 1).toString(10)}"
      data-to-logo="${TOKENS.to.token.address == ZERO ? BASE_LOGO : TOKENS.to.token.logoURI}"
      data-percent="${SHARE_PERCENT.dp(4, 1).toString(10)}"
      data-text="${SELECTED_PAIR ? "Confirm Supply" : "Create Pool & Supply"}"
      data-key="${SELECTED_PAIR ? "7" : "8"}"
    >
      Supply
    </button>
  `);
}

function updateToken(side) {
  if (TOKENS[side]) {
    const { balance, token } = TOKENS[side];
    $(`#balance-${side} span`).text(balance.dp(2, 1).toNumber());

    var thisInput = $('.swap-form__input-row[data-input="' + side + '"]');
    var thisSelect = $(thisInput).find(".select-token");
    var thisSelectIcon = $(thisSelect).find("img");
    var thisSelectTicker = $(thisSelect).find(".ticker");

    thisSelect.addClass("selected");
    thisSelect.attr("data-key", token.address);
    thisSelectIcon.attr("src", getTokenLogoUrl(token));
    thisSelectTicker.text(getTokenSymbol(token));
  }
}

async function onConfirmSupply() {
  const { from: fromToken, to: toToken } = TOKENS;
  $(".popup-overlay#confirm_supply").fadeOut(200);
  $(".popup-overlay#pending_supply").fadeIn(200);
  $(".popup__pending-details-info").text(`
    Supplying ${fromToken.amount.dp(6, 1).toString(10)} ${getTokenSymbol(fromToken.token)} and ${toToken.amount
    .dp(6, 1)
    .toString(10)} ${getTokenSymbol(toToken.token)}
  `);

  const { ACCOUNT, ROUTER_CONTRACT, ZERO } = window.variables;
  const { SLIPPAGE } = window.variables.liquidity;
  const blockInfo = await getBlockInfo();

  const deadline = ($("#swap-deadline").val() || DEFAULT_DESDLINE) * 60;
  const slippage = $(".swap-form__settings-slippage-values-item.active").attr("data-value") || SLIPPAGE;

  if ([fromToken.token.address, toToken.token.address].includes(ZERO)) {
    const isToETH = toToken.token.address === ZERO;
    send(ROUTER_CONTRACT.methods.addLiquidityETH)(
      isToETH ? fromToken.token.address : toToken.token.address,
      toWei(
        isToETH ? fromToken.amount : toToken.amount,
        isToETH ? fromToken.token.decimals : toToken.token.decimals
      ).toString(10),
      isToETH
        ? calculateSlippageAmount(fromToken, slippage)[0].toString(10)
        : calculateSlippageAmount(toToken, slippage)[0].toString(10),
      isToETH
        ? calculateSlippageAmount(toToken, slippage)[0].toString(10)
        : calculateSlippageAmount(fromToken, slippage)[0].toString(10),
      ACCOUNT,
      blockInfo.timestamp + deadline,
      {
        from: ACCOUNT,
        value: toWei(
          isToETH ? toToken.amount : fromToken.amount,
          isToETH ? toToken.token.decimals : fromToken.token.decimals
        ).toString(10),
      }
    )
      .send()
      .on("transactionHash", (hash) => {
        handleTransactionSuccess(hash);
        services.push({
          text: `Supply ${fromToken.amount.toFixed(4)} ${fromToken.token.symbol} and ${toToken.amount.toFixed(4)} ${
            toToken.token.symbol
          }`,
          hash,
        });
      })
      .on("receipt", (receipt) => {
        TOKENS.from = { ...TOKENS.from, isApproved: true };
        checkValid();
        services.update(receipt);
      })
      .on("error", (err, receipt) => {
        console.log("error :>> ", err);
        handleTransactionError();
        if (receipt) services.update(receipt);
      });
  } else {
    send(ROUTER_CONTRACT.methods.addLiquidity)(
      fromToken.token.address,
      toToken.token.address,
      toWei(fromToken.amount, fromToken.token.decimals).toString(10),
      toWei(toToken.amount, toToken.token.decimals).toString(10),
      calculateSlippageAmount(fromToken, slippage)[0].toString(10),
      calculateSlippageAmount(toToken, slippage)[0].toString(10),
      ACCOUNT,
      blockInfo.timestamp + deadline,
      {
        from: ACCOUNT,
      }
    )
      .send()
      .on("transactionHash", (hash) => {
        handleTransactionSuccess(hash);
        services.push({
          text: `Supply ${fromToken.amount.toFixed(4)} ${fromToken.token.symbol} and ${toToken.amount.toFixed(4)} ${
            toToken.token.symbol
          }`,
          hash,
        });
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
        handleTransactionError();
        if (receipt) services.update(receipt);
      });
  }
}

function onModalClose() {
  $(".popup-overlay").fadeOut(200);
}

function handleTransactionSuccess(hash) {
  $(".popup-overlay#pending_supply").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
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
  $(".popup-overlay#pending_supply").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup-overlay .popup__transaction-title").text("Transaction Rejected.");
  $(".popup-overlay .popup__transaction-btn").text("Dismiss");
}

function getTokenSymbol(token) {
  return token.address === window.variables.ZERO ? BASE_SYMBOL : token.symbol;
}

function getTokenLogoUrl(token) {
  return token.address === window.variables.ZERO ? BASE_LOGO : token?.logoURI || `images/defaultAsset.svg`;
}

function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
    sURLVariables = sPageURL.split("&"),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split("=");

    if (sParameterName[0] === sParam) {
      return typeof sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
    }
  }
  return false;
}

function calculateSlippageAmount({ amount, token: { decimals } }, slippage) {
  if (slippage < 0 || slippage > 10000) {
    slippage = DEFAULT_SLIPPAGE;
  }

  return [
    toWei(
      new BigNumber(
        new BigNumber(amount)
          .times(100 - slippage)
          .div(100)
          .toFixed(18)
      ),
      decimals
    ),
    toWei(
      new BigNumber(
        new BigNumber(amount)
          .times(100 + slippage)
          .div(100)
          .toFixed(18)
      ),
      decimals
    ),
  ];
}

function updateUrlParameter(key, value) {
  var queryParams = new URLSearchParams(window.location.search);

  queryParams.set(key, value);

  history.replaceState(null, null, `?${queryParams.toString()}`);
}

function onBalance(e, side) {
  const balance = $(`#balance-${side} span`).text();
  if (!isNaN(balance)) {
    const form = $(".swap-form");
    form.find(`[data-input="${side}"] input`).val(balance);
    onInputAmount({ target: { value: balance } }, side);
  }
}

function updatePoolShare(fromRate, toRate, sharePercent) {
  $(".swap-form__pool-share").html(`
    <div class="swap-form__pool-share-title">Prices and pool share</div>
    <div class="swap-form__pool-share-content">
      <div class="swap-form__pool-share-content__item">
        <div class="swap-form__pool-share-content__item-label">${TOKENS.to.token.symbol || BASE_SYMBOL} per ${
    TOKENS.from.token.symbol || BASE_SYMBOL
  }</div>
        <div class="swap-form__pool-share-content__item-value">${fromRate ? fromRate.toFormat(5) : "-"}</div>
      </div>
      <div class="swap-form__pool-share-content__item">
        <div class="swap-form__pool-share-content__item-label">${TOKENS.from.token.symbol || BASE_SYMBOL} per ${
    TOKENS.to.token.symbol || BASE_SYMBOL
  }</div>
        <div class="swap-form__pool-share-content__item-value">${toRate ? toRate.toFormat(6) : "-"}</div>
      </div>
      <div class="swap-form__pool-share-content__item">
        <div class="swap-form__pool-share-content__item-label">Share of Pool</div>
        <div class="swap-form__pool-share-content__item-value">${sharePercent.times(100).dp(2, 1).toString(10)}%</div>
      </div>
    </div>
  `);
}

function updateTip(type, onlyTitle = false) {
  if (type == TYPES.create) {
    $(".swap-form__title").html(`<h6>Create a pair</h6>`);
    if (!onlyTitle) {
      $(".swap-form__notice").show();
      $(".swap-form__notice").html(`
        <h6>You are the first liquidity provider.</h6>
        <p>The ratio of tokens you add will set the price of this pool.</p>
        <p>Once you are happy with the rate, click supply to review.</p>
      `);
    } else {
      $(".swap-form__notice").hide();
    }
  } else if (type == TYPES.add) {
    $(".swap-form__title").html(`<h6>Add liquidity</h6>`);
    if (!onlyTitle) {
      $(".swap-form__notice").show();
      $(".swap-form__notice").html(`
        <h6>Tip:</h6>
        <p>When you add liquidity, you will receive pool tokens representing your position. These tokens automatically earn fees proportional to your share of the pool, and can be redeemed at any time.</p>
      `);
    } else {
      $(".swap-form__notice").hide();
    }
  }
}

function onApprove(e, side) {
  $(".swap-approve-btn").addClass("btn-disabled");
  $(".swap-approve-btn").text("Approving...");

  const { token } = TOKENS[side];
  const { ACCOUNT, CONTRACT_ERC20_ABI } = window.variables;
  const tokenContract = new web3.eth.Contract(CONTRACT_ERC20_ABI, token.address);

  send(tokenContract.methods.approve)(
    window.variables.CONTRACT_ROUTER_ADDRESS,
    new BigNumber(2).pow(256).minus(1).toString(10),
    { from: ACCOUNT }
  )
    .send()
    .on("transactionHash", (hash) => {
      services.push({ text: `Approve ${token.symbol}`, hash });
    })
    .on("receipt", (receipt) => {
      TOKENS[side] = { ...TOKENS[side], isApproved: true };
      checkValid();
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      $(".swap-approve-btn").removeClass("btn-disabled");
      $(".swap-approve-btn").text(`Approve ${token.symbol}`);
      if (receipt) services.update(receipt);
    });
}
