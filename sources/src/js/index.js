"use strict";

function getBindEvent(target, eventKey) {
  return $(target).attr(eventKey);
}

function getTargetEvent(e, eventKey) {
  let target = e.target;
  while (target && !getBindEvent(target, eventKey)) {
    target = target.parentElement;
  }
  if (!target) return "";
  return $(target).attr(eventKey).split(":");
}

$(window).on("load", () => {
  window.variables.TOKEN_LIST = {
    4: [{
      address: "0x99BB38c25711ac1915FD0E9781ddBC421Fc0f625",
      decimals: 18,
      logoURI: null,
      name: "Sword Token",
      symbol: "SWARD",
    }, {
      address: "0x5D592120FfA6d8FDE0Bf05a06A8c0A94a6377C62",
      decimals: 18,
      logoURI: null,
      name: "Uniswap V2 LP",
      symbol: "LP",
    }]
  };
  triggerEvent("onLoad");

  $(document).on("click", "[data-popup-dismiss]", function (e) {
    const bind = getBindEvent(e.target, "data-popup-dismiss");
    if (bind) {
      $(`#${bind}`).removeClass("is-active");
    }
  });

  $(document).on("click", "[data-event-click]", function (e) {
    e && e.preventDefault();
    const [key, params = ""] = getTargetEvent(e, "data-event-click");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("change", "[data-event-change]", function (e) {
    const [key, params = ""] = getTargetEvent(e, "data-event-change");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("keyup", "[data-event-input]", function (e) {
    const [key, params = ""] = getTargetEvent(e, "data-event-input");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("submit", "[data-submit]", function (e) {
    e.preventDefault();
    const [key] = getTargetEvent(e, "data-submit");
    if (window.events[key]) triggerEvent(key);
  });
  $(document).tooltip();
});
