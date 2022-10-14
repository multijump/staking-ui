function getZeros(len) {
  return new Array(len).fill(0).join("");
}

function getNumberInString(seq = 30) {
  return new BigNumber(`1${getZeros(seq)}`);
}

function toFixed(value, decimals) {
  return new BigNumber(value.toFixed(decimals, 1));
}

function toWei(value, decimals = 18) {
  return toFixed(value.times(10 ** decimals), 0);
}

function fromWei(value, decimals = 18) {
  return toFixed(value.div(10 ** decimals), decimals);
}

function getData(elem, key = "key") {
  return elem.data(key);
}
