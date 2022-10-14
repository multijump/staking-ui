"use strict";

var countingTo = 0

window.onload = function () {
  window.variables.pool = {};
  // window.triggers.onLoad = [
  //   ...(window.triggers.onLoad || []),
  //   "initPool"
  // ];
  window.events.resetPools = resetPools;
  window.triggers.networkChanged = [
    ...(window.triggers.networkChanged || []),
    "resetPools"
  ];
  // window.events.updatePool = updatePool;

  $(document).on('click', '.pool-accordion-expander', function(e) {
    e.preventDefault();
    const _id = $(this).attr('data-id');
    $(this).empty();
    if (this.classList.contains('closed')) {
      $(this).append(`
        Manage
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 10px;">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      `);
    } else {
      $(this).append(`
        Manage
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 10px;">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `);
    }
    this.classList.toggle('closed')
    
    $(`#${_id}`).slideToggle('slow');
  });
  
  setInterval(() => {
    const { ACCOUNT } = window.variables;
    if (ACCOUNT) {
      countingTo += 1;
      $('.pool__about .seconds').text(countingTo);
      if (countingTo === 60) {
        initPool();
      }
    }
  }, 1000)
};

function resetPools() {
  console.log('Run reset pools');
  window.variables.PAIR_TOKEN_CONTRACTS = {};
  window.variables.pool = {};
  window.variables.pool.PAIRS = [];
  initPool();
}

function initPool() {
  initData(function (pairs, contracts) {
    const { PAIR_TOKEN_CONTRACTS = {}, pool: { PAIRS = [] } } = window.variables
    window.variables.PAIR_TOKEN_CONTRACTS = { ...PAIR_TOKEN_CONTRACTS, ...contracts };
    window.variables.pool.PAIRS = [...PAIRS, ...pairs];
    // window.variables.pool.USERS = [];
    // window.variables.pool.ALLOWANCES = [];

    if (window.variables.ACCOUNT) {
      updatePool();
      countingTo = 0;
    }
  });
}

function updatePool() {
  const { ACCOUNT } = window.variables;
  if (window.variables.pool.PAIRS && ACCOUNT) {
    initUserData(function (balances) {
      renderPools(window.variables.pool.PAIRS, balances);
    });
  } else {
    renderPools([], []);
  }
}

function initData(callback) {
  const { pool: { PAIRS = [] } } = window.variables
  Promise.all([
    getFullPairs(PAIRS.length)
  ])
    .then(function ([
      pairs
    ]) {
      const pairTokenContracts = Object.fromEntries(pairs.map(pair => [pair.id, getPairTokenContract(pair.id)]));
      callback(pairs, pairTokenContracts);
    })
    .catch(console.log);
}

function initUserData(callback) {
  const { ACCOUNT, pool: { PAIRS } } = window.variables
  Promise.all([
    ACCOUNT && PAIRS ? getBalances(ACCOUNT, PAIRS) : Promise.resolve([]),
  ])
    .then(([balances]) => {
      window.variables.pool.BALANCES = balances;
      callback(balances);
    })
    .catch(console.log)
}

function renderPools(pairs, balances) {
  if (pairs.length > 0) {
    let appended = 0;
    pairs.forEach(pair => {
      const { balance } = balances[pair.id];
      const {
        token0,
        token1,
        reserve0,
        reserve1,
        totalSupply
      } = pair;

      if (new BigNumber(balance).toNumber() > 0) {
        const assets = window.variables.TOKEN_LIST[window.variables.NETWORK];
        const firstIconUrl = assets.find(asset => asset.address.toLowerCase() === pair.token0.id.toLowerCase())?.logoURI || `images/defaultAsset.svg`;
        const secondIconUrl = assets.find(asset => asset.address.toLowerCase() === pair.token1.id.toLowerCase())?.logoURI || `images/defaultAsset.svg`;
        const poolShare = balance / totalSupply;
        const poolSharePercent = new BigNumber(poolShare * 100).toFormat(2);
        const pooledToken0 = new BigNumber(reserve0 * poolShare).toFormat(8);
        const pooledToken1 = new BigNumber(reserve1 * poolShare).toFormat(8);
        const existPool = $(".pool__descr").find(`#${pair.id}`);
        if ($(".pool__descr").find(`div`).length == 0) {
          $(".pool__descr").empty();
        }

        if (!existPool.length) {
          $(".pool__descr").append(`
            <div id="${pair.id}" class="pool-accordion"> 
              <div class="pool-accordion--title"> 
                <div class="pool-accordion--title-pair-info">
                  <div class="pool-accordion--title-pair-info-images">
                    <img src="${firstIconUrl}">
                    <img src="${secondIconUrl}">
                  </div>
                  <div class="pool-accordion--title-pair-info-text">${token0.symbol} / ${token1.symbol}</div>
                </div>
                <div class="pool-accordion--title-button">
                  <button class="pool-accordion-expander closed" data-id="${token0.symbol}-${token1.symbol}">
                    Manage
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 10px;">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="pool-accordion--body" id="${token0.symbol}-${token1.symbol}" style="display:none;"> 
                <div class="pool-accordion--body-text-item"> 
                  <div class="pool-accordion--body-text-item-descr">Your total pool tokens:</div>
                  <div class="pool-accordion--body-text-item-value balance">${balance}</div>
                </div>
                <div class="pool-accordion--body-text-item"> 
                  <div class="pool-accordion--body-text-item-descr">Pooled ${token0.symbol}:</div>
                  <div class="pool-accordion--body-text-item-value pooled-token0">
                    <span>${pooledToken0}</span>
                    <img src="${firstIconUrl}">
                  </div>
                </div>
                <div class="pool-accordion--body-text-item"> 
                  <div class="pool-accordion--body-text-item-descr">Pooled ${token1.symbol}:</div>
                  <div class="pool-accordion--body-text-item-value pooled-token1">
                    <span>${pooledToken1}</span>
                    <img src="${secondIconUrl}">
                  </div>
                </div>
                <div class="pool-accordion--body-text-item"> 
                  <div class="pool-accordion--body-text-item-descr">Your pool share:</div>
                  <div class="pool-accordion--body-text-item-value pool-share-percent">${poolSharePercent}%</div>
                </div>
                <a href="https://info.swipe.org/pairs/${pair.id}" target="_blink" class="pool-accordion--body-link-item">
                  View accrued fees and analytics
                  <span style="font-size: 11px;">↗</span>
                </a>
                <div class="pool-accordion--body-button-item">
                  <a class="btn" href="add-liquidity.html?type=add&inputCurrency=${token0.id}&outputCurrency=${token1.id}">Add</a>
                  <a class="btn" href="remove-liquidity.html?token0=${token0.id}&token1=${token1.id}">Remove</a>
                </div>
              </div>
            </div>
          `);
        } else {
          existPool.find("pool-accordion--body-text-item-value.balance").text(balance);
          existPool.find("pool-accordion--body-text-item-value.pool-share-percent").text(`${poolSharePercent}%`);
          existPool.find("pool-accordion--body-text-item-value.pooled-token0 span").text(`${pooledToken0}%`);
          existPool.find("pool-accordion--body-text-item-value.pooled-token1 span").text(`${pooledToken1}%`);
        }
        appended++;
      }
    });

    if (!appended) {
      $(".pool__descr").text("You don't have any liquidity pools");
    }
  } else {
    $(".pool__descr").text("Connect a wallet to view your liquidity.");
  }
}