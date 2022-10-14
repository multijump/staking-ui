const hookNetworks = [56, 97];

function isHook() {
  const { NETWORK } = window.variables;
  return hookNetworks.includes(NETWORK);
}

function createHook([target, hook, event, replacing]) {
  const holder = event ? window.events : window;
  const originFunc = holder[target];
  if (!originFunc) return;
  window.hooked[`${target}_${replacing ? "r" : "h"}`] = originFunc;
  holder[target] = function (...args) {
    if (replacing) {
      if (isHook()) {
        return hook.apply(this, args);
      } else {
        return originFunc.apply(this, args);
      }
    } else {
      const ret = originFunc.apply(this, args);
      if (ret && typeof ret.then === "function") {
        return ret.then((value) => {
          hook([value, args]);
          return value;
        });
      } else {
        hook([ret, args]);
        return ret;
      }
    }
  };
}

window.hooked = {};

window.hooks = [
  [
    "getPools",
    function getPoolsBSC() {
      return getPoolsFromBSC();
    },
    false,
    true,
  ],
  [
    "initFarm",
    function ([value, args]) {
      // console.log("Hook Data", [value, args]);
      // console.log("You are hooking initFarm function");
    },
    true,
    false,
  ],
];
