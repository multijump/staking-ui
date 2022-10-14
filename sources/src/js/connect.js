"use strict";

var web3, provider, web3Modal, netId;

const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const EvmChains = window.evmChains;

// const Fortmatic = window.Fortmatic;

/**
 * Disconnect wallet button pressed.
 *
 */
function onDisconnect() {
  console.log("Killing the wallet connection", provider);

  if (provider.close) {
    provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    web3Modal.clearCachedProvider();
    provider = null;
  }

  // Set the UI back to the initial state
  // document.querySelector('#prepare').style.display = 'block';
  // document.querySelector('#connected').style.display = 'none';
  triggerEvent("selectAccount", null);
}

function init() {
  // if (location.protocol !== 'https:') {
  //     console.error("Not using HTTPS protocol...")
  //     document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  //     return;
  // }

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  if (provider) {
    onDisconnect();
  }

  const providerOptions = {
    injected: {
      id: 1,
      display: {
        // logo: "/images/metamask.png",
        name: "Metamask",
      },
      package: null,
    },

    walletconnect: {
      id: 2,
      package: WalletConnectProvider,
      display: {
        // logo: "/images/trust-wallet.png",
        name: "Trust Wallet",
      },
      options: {
        // Mikko's test key - don't copy as your mileage may vary
        infuraId: "8043bb2cf99347b1bfadfb233c5325c0",
      },
    },

    // fortmatic: {
    //     package: Fortmatic,
    //     options: {
    //         // Mikko's TESTNET api key
    //         key: "pk_test_391E26A3B43A3350",
    //         network: "ropsten"
    //     }
    // }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });
}

/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
function fetchAccountData() {
  // Get a Web3 instance for the wallet
  web3 = new Web3(provider);

  Promise.all([
    // Get connected chain id from Ethereum node
    netId ? Promise.resolve(0) : web3.eth.getChainId(),

    // Get list of accounts of the connected wallet
    web3.eth.getAccounts(),
  ])
    .then(([chainId, accounts]) => {
      // Load chain information over an HTTP API
      const chainData = netId ? Promise.resolve(0) : EvmChains.getChain(chainId);
      // document.querySelector("#network-name").textContent = chainData.name;

      // MetaMask does not give you all accounts, only the selected account
      triggerEvent("selectAccount", accounts[0], !netId ? chainData : { networkId: netId });

      setup();
      load();
    })
    .catch(console.log);
}

function refreshAccountData() {
  // If any current data is displayed when
  // the user is switching acounts in the wallet
  // immediate hide this data
  // document.querySelector("#connected").style.display = "none";
  // document.querySelector("#prepare").style.display = "block";

  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.

  // document.querySelector('#btn-connect').setAttribute('disabled', 'disabled');
  fetchAccountData();
  // document.querySelector('#btn-connect').removeAttribute('disabled');
}

/**
 * Connect wallet button pressed.
 */
function onConnect(resolve) {
  const providerResolve = resolve ? Promise.resolve(resolve) : web3Modal.connect()
  netId = resolve
    ? (window.ethereum.networkVersion ? +window.ethereum.networkVersion : +window.ethereum.chainId)
    : 0
  providerResolve.then((connectedProvider) => {
    provider = connectedProvider;

    if (provider.on) {
      // Subscribe to accounts change
      provider.on("accountsChanged", (accounts) => {
        fetchAccountData();
      });

      // Subscribe to chainId change
      provider.on("chainChanged", (chainId) => {
        netId = 0;
        fetchAccountData();
      });

      // Subscribe to networkId change
      // provider.on("networkChanged", (networkId) => {
      //   fetchAccountData();
      // });
    }

    refreshAccountData();
    $("button.js-popup-close").click();
  })
    .catch((e) => {
      console.log("Could not get a wallet connection", e);
      $("button.js-popup-close").click();
    });
}

// Loads once
function setup() { }

function initTokenContracts() {
  window.variables.FACTORY_CONTRACT = new web3.eth.Contract(
    window.variables.CONTRACT_FACTORY_ABI,
    window.variables.CONTRACT_FACTORY_ADDRESS
  );
  window.variables.PAIR_TOKEN_CONTRACTS = {};
  window.variables.PAIR_TOKEN_CONTRACTS[window.variables.CONTRACT_SWORD_ADDRESS] = new web3.eth.Contract(
    window.variables.CONTRACT_SWORD_ABI,
    window.variables.CONTRACT_SWORD_ADDRESS
  );
  window.variables.PAIR_TOKEN_CONTRACTS[window.variables.CONTRACT_LP_ADDRESS] = new web3.eth.Contract(
    window.variables.CONTRACT_LP_ABI,
    window.variables.CONTRACT_LP_ADDRESS
  );
}

function registerToken({ address, ...token }) {
  const { CONTRACT_ERC20_ABI } = window.variables;
  window.variables.TOKEN_CONTRACTS[address] = {
    ...token,
    contract: new web3.eth.Contract(CONTRACT_ERC20_ABI, address),
  }
}

var balanceTimer = null;

var call = (method, resolve) => (...args) =>
  resolve
    ? new Promise((resolve) =>
      method(...args)
        .call()
        .then(resolve)
        .catch(() => resolve(null))
    )
    : method(...args).call();
var send = (method) => (...args) => {
  const option = args.pop();
  const transaction = method(...args);
  return {
    estimate: () => transaction.estimateGas(option),
    send: () => transaction.send(option),
    transaction,
  };
};

function getContractInfo() {
  const { ACCOUNT } = window.variables;
  if (ACCOUNT) {
    web3.eth
      .getBalance(ACCOUNT)
      .then((balance) => {
        window.variables.BALANCE = web3.utils.fromWei(balance);
        triggerEvent("fetchBalance");
      })
      .catch(console.log);
  }
}

function getTokenInfo(address = window.variables.ZERO) {
  const {
    ACCOUNT,
    TOKEN_CONTRACTS: { [address]: { contract, symbol, ...token } = {} },
    CONTRACT_ROUTER_ADDRESS,
  } = window.variables;
  const { decimals = 18 } = token;
  return Promise.all([
    !contract
      ? web3.eth.getBalance(ACCOUNT)
      : call(contract.methods.balanceOf)(ACCOUNT),
    !contract
      ? Promise.resolve(true)
      : call(contract.methods.allowance)(ACCOUNT, CONTRACT_ROUTER_ADDRESS),
  ]).then(([balance, allowance]) => [
    fromWei(new BigNumber(balance), decimals),
    !contract ? true : !fromWei(new BigNumber(allowance), decimals).isZero(),
    { ...token, symbol: symbol || BASE_SYMBOL, address },
  ]);
}

function load() {
  if (balanceTimer) clearInterval(balanceTimer);
  balanceTimer = setInterval(() => {
    getContractInfo();
  }, 1 * 60 * 1000);
  getContractInfo();
}

const networks = {
  // 1: {
  //   chainId: '0x1',
  //   chainName: 'Ethereum Mainnet',
  //   nativeCurrency: {
  //     name: 'Ethereum',
  //     symbol: 'ETH',
  //     decimals: 18,
  //   },
  //   rpcUrls: ["https://mainnet.infura.io/v3"],
  //   blockExplorerUrls: ['https://etherscan.io/'],
  // },
  56: {
    chainId: '0x38',
    chainName: 'Binance Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ['https://bscscan.com/'],
  }
}

function changeNetworkRequest(network) {
  if (!networks[network]) return;
  web3.currentProvider.request({
    method: 'wallet_addEthereumChain',
    params: [
      networks[network],
    ],
  })
}

init();
