window.events = {
  onLoad: (...triggers) => {
    console.log("app loaded");
    triggerEvent("restoreSession");
    triggers.forEach(triggerEvent);
  },
  // Web3Modal
  connect: (idx) => {
    switch (Number(idx)) {
      case 1:
      case 2:
        $(`.web3modal-provider-wrapper:nth-child(${idx})`).click();
        localStorage.setItem("last_try", idx);
        break;
      default:
        break;
    }
  },
  restoreSession: () => {
    if (localStorage.getItem("last_connect")) {
      setTimeout(() => {
        onConnect(localStorage.getItem("last_connect") === '1' ? window.ethereum : null);
        triggerEvent("connect", localStorage.getItem("last_connect"));
      });
    } else if (window.ethereum) {
      onConnect(window.ethereum);
    }
  },
  selectAccount: (addr = "", chainData, ...triggers) => {
    $(".connect-btn span").text(shortenAddr(addr));
    if (
      (!window.variables.ACCOUNT && addr) ||
      (window.variables.ACCOUNT && !addr)
    ) {
      $(".user-connected").toggleClass("hidden");
      if (addr && localStorage.getItem("last_try")) {
        localStorage.setItem("last_connect", localStorage.getItem("last_try"));
      }
    }
    window.variables.ACCOUNT = addr;
    if (window.variables.NETWORK !== chainData.networkId) {
      configNetwork(chainData.networkId);
    }

    const { ACCOUNT, NETWORK } = window.variables;
    initTokenContracts();
    // selectToken(commonBases, tokens);

    ACCOUNT && NETWORK && triggers.forEach(triggerEvent);
  },
  networkChanged: (...triggers) => {
    console.log("Network changed", window.variables.NETWORK);
    triggers.forEach(triggerEvent);
  },
  searchChanged: (value) => {
    try {
      if (!value || !value.startsWith('0x')) return
      const { NETWORK, CONTRACT_ERC20_ABI } = window.variables;
      const address = toChecksumAddress(value);
      if ((window.variables.TOKEN_LIST[NETWORK] || []).find(token => token.address === address)) return
      const contract = new web3.eth.Contract(CONTRACT_ERC20_ABI, address);
      const logoURI = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
      Promise.all([
        call(contract.methods.symbol)(),
        call(contract.methods.name)(),
        call(contract.methods.decimals)(),
        urlCheck(logoURI)
      ]).then(([symbol, name, decimals, hasLogo]) => {
        services.tokenSuggest({
          address,
          decimals: Number(decimals),
          logoURI: hasLogo ? logoURI : 'images/swap/error.svg',
          name,
          symbol,
        });
      }).catch(console.log)
    } catch(e) {
      console.log(e);
    }
  },
  logout: () => {
    //
    onDisconnect();
  },
};

window.triggers = {};

function triggerEvent(key, ...params) {
  if (window.events[key]) {
    window.events[key](...params, ...(window.triggers[key] || []));
  }
}
