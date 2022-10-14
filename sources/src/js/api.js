const TOKEN_LIST = "https://tokens.swipe.org/";

function getAssets() {
  return Promise.all([
    $.get(TOKEN_LIST),
    // 
  ]);
}

function urlCheck(url) {
  return new Promise(resolve => $.get(url).then(() => resolve(true)).catch(() => resolve(0)));
}