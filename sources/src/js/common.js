function shortenAddr(address) {
  if (!address) return 'Unlock Wallet';
  return `${address.substr(0, 5)}...${address.substr(-4)}`;
}

async function getBlockInfo() {
  return new Promise((resolve, reject) => {
    window.web3.eth.getBlockNumber((err, blockNumber) => {
      if (err !== null) {
        reject(err);
      } else {
        resolve(window.web3.eth.getBlock(blockNumber));
      }
    });
  });
};