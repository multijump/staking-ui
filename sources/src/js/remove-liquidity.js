"use strict";

const SIDE_NAMES = {
  token0: "token0",
  token1: "token1",
};

const TOKENS = {
  token0: {},
  token1: {},
};

const userInfo = {
  lpBalance: 0,
  isApproved: false,
  pairAddress: null,
};

window.onload = function () {
  window.triggers.selectAccount = [
    ...(window.triggers.selectAccount || []),
    "init",
  ];
  window.events.init = init;
  window.events.onConfirmRemove = onConfirmRemove;
  window.events.onPercentChange = onPercentChange;
  window.events.onApprove = onApprove;
  window.events.initRemoveModal = initRemoveModal;
  window.events.onModalClose = onModalClose;
};

async function init() {
  const { ZERO, TOKEN_LIST, NETWORK } = window.variables;
  const assets = TOKEN_LIST[NETWORK];
  const token0Addr = getUrlParameter(SIDE_NAMES.token0) || ZERO;
  const token1Addr = getUrlParameter(SIDE_NAMES.token1) || ZERO;

  TOKENS.token0 = assets.find(
    (asset) => asset.address.toLowerCase() === token0Addr
  );
  TOKENS.token1 = assets.find(
    (asset) => asset.address.toLowerCase() === token1Addr
  );

  $("#remove-form__from-token-img").attr("src", TOKENS.token0.logoURI);
  $("#remove-form__from-token-symbol").text(TOKENS.token0.symbol);
  $("#remove-form__to-token-img").attr("src", TOKENS.token1.logoURI);
  $("#remove-form__to-token-symbol").text(TOKENS.token1.symbol);

  await updatePairInfo();
}

async function onConfirmRemove() {
  const { token0, token1 } = TOKENS;
  $(".popup-overlay#confirm_remove").fadeOut(200);
  $(".popup-overlay#pending_transaction").fadeIn(200);
  $(".popup__pending-details-info").text(`
    Removing ${token0.withdrawAmount.dp(6, 1).toString(10)} ${
    token0.symbol
  } and ${token1.withdrawAmount.dp(6, 1).toString(10)} ${token1.symbol}
  `);

  const {
    ACCOUNT,
    ROUTER_CONTRACT,
    CONTRACT_ROUTER_ADDRESS,
  } = window.variables;
  const blockInfo = await getBlockInfo();

  let encodedABI = ROUTER_CONTRACT.methods
    .removeLiquidity(
      token0.address,
      token1.address,
      `0x${userInfo.withdrawLP.times(1e18).dp(0, 0).toString(16)}`,
      0,
      0,
      ACCOUNT,
      blockInfo.timestamp + 120
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
        text: `Remove ${token0.withdrawAmount.dp(6, 1).toString(10)} ${
          token0.symbol
        } and ${token1.withdrawAmount.dp(6, 1).toString(10)} ${token1.symbol}`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      console.log("receipt :>> ", receipt);
      handlePercent(0);
      updatePairInfo();
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("err :>> ", err);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
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
}

function handleTransactionError() {
  $(".popup-overlay#pending_transaction").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup__transaction-img").attr("src", "images/swap/error.svg");
  $(".popup-overlay .popup__transaction-title").text("Transaction Rejected.");
  $(".popup-overlay .popup__transaction-btn").text("Dismiss");
}

function getTokenSymbol(token) {
  return token.address === window.variables.ZERO ? BASE_SYMBOL : token.symbol;
}

function getTokenLogoUrl(token) {
  return token.address === window.variables.ZERO
    ? BASE_LOGO
    : token?.logoURI || `images/defaultAsset.svg`;
}

function getUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
    sURLVariables = sPageURL.split("&"),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split("=");

    if (sParameterName[0] === sParam) {
      return typeof sParameterName[1] === undefined
        ? true
        : decodeURIComponent(sParameterName[1]);
    }
  }
  return false;
}

async function updatePairInfo() {
  window.variables.FACTORY_CONTRACT = new web3.eth.Contract(
    window.variables.CONTRACT_FACTORY_ABI,
    window.variables.CONTRACT_FACTORY_ADDRESS
  );
  const {
    CONTRACT_FACTORY_ABI,
    CONTRACT_FACTORY_ADDRESS,
    CONTRACT_ROUTER_ADDRESS,
    ACCOUNT,
  } = window.variables;
  const factory_contract = new web3.eth.Contract(
    CONTRACT_FACTORY_ABI,
    CONTRACT_FACTORY_ADDRESS
  );
  const pairAddress = await factory_contract.methods
    .getPair(TOKENS.token0.address, TOKENS.token1.address)
    .call();
  userInfo.pairAddress = pairAddress;
  const pairContract = getPairTokenContract(pairAddress);
  const token0address = await pairContract.methods.token0().call();
  const balance = await pairContract.methods.balanceOf(ACCOUNT).call();
  const totalSupply = await pairContract.methods.totalSupply().call();
  const approvedAmount = await pairContract.methods
    .allowance(ACCOUNT, CONTRACT_ROUTER_ADDRESS)
    .call();

  const reserve0Decimals = token0address === TOKENS.token0.address ? TOKENS.token0.decimals : TOKENS.token1.decimals;
  const reserve1Decimals = token0address === TOKENS.token0.address ? TOKENS.token1.decimals : TOKENS.token0.decimals;

  const {
    _reserve0: reserve0,
    _reserve1: reserve1,
  } = await pairContract.methods.getReserves().call();

  const token0Amount = new BigNumber(reserve0)
    .times(new BigNumber(balance).div(new BigNumber(totalSupply)))
    .div(new BigNumber(10).pow(reserve0Decimals));

  const token1Amount = new BigNumber(reserve1)
    .times(new BigNumber(balance).div(new BigNumber(totalSupply)))
    .div(new BigNumber(10).pow(reserve1Decimals));

  if (token0address === TOKENS.token0.address) {
    TOKENS.token0 = {
      ...TOKENS.token0,
      amount: token0Amount,
    };
    TOKENS.token1 = {
      ...TOKENS.token1,
      amount: token1Amount,
    };
  } else {
    TOKENS.token0 = {
      ...TOKENS.token0,
      amount: token1Amount,
    };
    TOKENS.token1 = {
      ...TOKENS.token1,
      amount: token0Amount,
    };
  }
  const { token0, token1 } = TOKENS;
  $(".remove-form__price").html(`
    <div class="remove-form__price-title">Price:</div>
    <div class="remove-form__price-values">
      <div class="remove-form__price-values-item">1 ${
        token0.symbol
      } = ${token1.amount.div(token0.amount).dp(6, 1).toString(10)} ${
    token1.symbol
  }</div>
      <div class="remove-form__price-values-item">1 ${
        token1.symbol
      } = ${token0.amount.div(token1.amount).dp(6, 1).toString(10)} ${
    token0.symbol
  }</div>
    </div>
  `);

  userInfo.lpBalance = new BigNumber(balance).div(1e18);
  userInfo.isApproved = new BigNumber(approvedAmount).isZero() ? false : true;
}

function onPercentChange(e, val) {
  if (val) {
    handlePercent(val);
  } else {
    handlePercent(e.target.value);
  }
}

function onApprove() {
  const { CONTRACT_ROUTER_ADDRESS, ACCOUNT } = window.variables;
  const pairContract = getPairTokenContract(userInfo.pairAddress);
  $(".remove-form__action-btn").addClass("btn-disabled");
  $(".remove-form__action-btn").text("Approving...");

  send(pairContract.methods.approve)(
    CONTRACT_ROUTER_ADDRESS,
    new BigNumber(2).pow(256).minus(1).toString(10),
    { from: ACCOUNT }
  )
    .send()
    .on("transactionHash", (hash) => {
      services.push({
        text: `Approve ${TOKENS.token0.symbol}/${TOKENS.token1.symbol} LP`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      userInfo.isApproved = true;
      handlePercent(0);
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      $(".remove-form__action-btn").removeClass("btn-disabled");
      $(".remove-form__action-btn").text("Approve");
      if (receipt) services.update(receipt);
    });
}

function handlePercent(val) {
  TOKENS.token0 = {
    ...TOKENS.token0,
    withdrawAmount: TOKENS.token0.amount.times(Number(val)).div(100),
  };
  TOKENS.token1 = {
    ...TOKENS.token1,
    withdrawAmount: TOKENS.token1.amount.times(Number(val)).div(100),
  };
  userInfo.withdrawLP = userInfo.lpBalance.times(Number(val)).div(100);
  $(".remove-form__amount-percent").text(`${val} %`);
  $(".remove-form__amount-range").val(val);
  if (Number(val) === 0) {
    $(".remove-token0-amount").text("-");
    $(".remove-token1-amount").text("-");
    $(".remove-form__action").html(`
      <div class="remove-form__action-btn btn btn-big btn-disabled">
        Enter Amount
      </div>
    `);
  } else {
    $(".remove-token0-amount").text(
      TOKENS.token0.withdrawAmount.dp(8, 1).toString(10)
    );
    $(".remove-token1-amount").text(
      TOKENS.token1.withdrawAmount.dp(8, 1).toString(10)
    );
    if (userInfo.isApproved) {
      $(".remove-form__action").html(`
        <div
          class="remove-form__action-btn btn btn-big js-popup-open"
          href="#confirm_remove"
        >
          Remove
        </div>
      `);
    } else {
      $(".remove-form__action").html(`
        <div
          class="remove-form__action-btn btn btn-big"
          data-event-click="onApprove"
        >
          Approve
        </div>
      `);
    }
  }
}

function initRemoveModal() {
  const { token0, token1 } = TOKENS;
  $(".popup__remove-token0").html(`
    <div class="popup__remove-token-value">${token0.withdrawAmount
      .dp(8, 1)
      .toString(10)}</div>
    <div class="popup__remove-token-label">
      <img src="${token0.logoURI}" width="24px" height="24px">
      <span>${token0.symbol}</span>
    </div>
  `);

  $(".popup__remove-token1").html(`
    <div class="popup__remove-token-value">${token1.withdrawAmount
      .dp(8, 1)
      .toString(10)}</div>
    <div class="popup__remove-token-label">
      <img src="${token1.logoURI}" width="24px" height="24px">
      <span>${token1.symbol}</span>
    </div>
  `);

  $(".popup__remove-burn").html(`
    <div class="popup__remove-burn-label">LP ${token0.symbol}/${
    token1.symbol
  } Burned</div>
    <div class="popup__remove-burn-value">
      <img src="${token0.logoURI}" width="24px" height="24px">
      <img src="${token1.logoURI}" width="24px" height="24px">
      <span>${userInfo.withdrawLP.dp(6, 1).toString(10)}</span>
    </div>
  `);

  $(".popup__remove-price").html(`
    <div class="popup__remove-price-title">Price:</div>
    <div class="popup__remove-price-values">
      <div class="popup__remove-price-values-item">1 ${
        token0.symbol
      } = ${token1.amount.div(token0.amount).dp(6, 1).toString(10)} ${
    token1.symbol
  }</div>
      <div class="popup__remove-price-values-item">1 ${
        token1.symbol
      } = ${token0.amount.div(token1.amount).dp(6, 1).toString(10)} ${
    token0.symbol
  }</div>
    </div>
  `);
}

function onModalClose() {
  $(".popup-overlay").fadeOut(200);
}
