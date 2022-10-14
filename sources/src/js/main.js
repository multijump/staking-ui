"use strict";
//--------------------------
// Ready                   |
//--------------------------

$(document).ready(function () {
  $.expr[":"].contains = $.expr.createPseudo(function (arg) {
    return function (elem) {
      return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
  });

  $(document).on("click", 'a[href="#"]', function (e) {
    e.preventDefault();
  });

  fixedHeader();
  hamburgerMenu();
  headerMenu();
  customSelect();
  popups();
  swapInputs();
  seeMoreItems();
  darkMode();
}); // end ready

//--------------------------
// Resize trigger          |
//--------------------------

$(window)
  .resize(function () {
    fix100vh();
    footerAccordion();
  })
  .trigger("resize");

//--------------------------
// Functions               |
//--------------------------
function fix100vh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

function fixedHeader() {
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 0) {
      $(".header--transparent").addClass("is-fixed");
    } else {
      $(".header--transparent").removeClass("is-fixed");
    }
  });
}

function hamburgerMenu() {
  $(document).on("click", ".hamburger", function () {
    $(this).toggleClass("is-active");
    if ($(this).hasClass("is-active")) {
      $(".header__menu").fadeIn();
      document.body.style.overflow = "hidden";
    } else {
      $(".header__menu").fadeOut();
      document.body.style.overflow = "";
    }
    return false;
  });
}

// header menus
function headerMenu() {
  $(".header__menu-main").hover(
    function () {
      // $(this).find(".header__menu-submenu").show()
      $(this).find(".header__menu-submenu").addClass("selected");
    },
    function () {
      $(this).find(".header__menu-submenu").removeClass("selected");
      // $(this).find(".header__menu-submenu").hide()
    }
  );
}

function footerAccordion() {
  if ($(window).width() <= 499) {
    $(".footer__col-head")
      .off("click")
      .on("click", function () {
        $(this).next().stop().slideToggle();
      });
  } else $(".footer__col-head").off("click");
}

function customSelect() {
  $(document).on("click", ".select__in", function () {
    var $thisSelect = $(this).closest(".select");
    $(".select").not($thisSelect).removeClass("is-opened");
    $(this).closest(".select").toggleClass("is-opened");
  });
  $(document).on("click", ".select__item", function () {
    var $thisSelect = $(this).closest(".select");
    $thisSelect.find(".select__input").val($(this).attr("data-value"));
    $thisSelect.find(".select__in").html($(this).html());
    $thisSelect.find(".select__item").removeClass("is-active");
    $(this).addClass("is-active");
    $thisSelect.removeClass("is-opened");
  });
  $(document).on("click", function (e) {
    var container = $(".select");
    if (!$(e.target).closest(container).length && $(".select").hasClass("is-opened"))
      $(".select").removeClass("is-opened");
  });
  $(document).on("keyup", function (e) {
    if (e.keyCode == 27) $(".select").removeClass("is-opened");
  });
}

function popups() {
  $(document).on("click", ".js-popup-open", function (e) {
    onConnect();
    var _id = $(this).attr("href");
    $(_id).fadeIn(200);

    document.body.style.overflow = "hidden";

    if (_id == "#select_token") {
      var thisInput = $(this).parent().data("input");
      var thisCurrentCoin = $(this).find(".ticker").text();
      var commonBases = $(_id).find(".cb-item");
      $(_id).attr("data-input", thisInput);
      commonBases.each(function () {
        var _thisTicker = $(this).find(".ticker").text();
        if (_thisTicker == thisCurrentCoin) {
          $(commonBases).removeClass("selected");
          $(this).addClass("selected");
        }
      });
      $(".search-input input").val("");
      $(".search-input ~ .token-list .token-list__item").show();
    }

    if (_id == "#login_using") {
      var walletName = $(this).find("span").text();
      var walletLogoSrc = $(this).find("img").attr("src");
      $(_id).find("#wallet_name").text(walletName);
      $(_id).find("#wallet_logo").attr("src", walletLogoSrc);
    } else if (_id === "#metamask") {
      triggerEvent("connect", 1);
    } else if (_id === "#walletconnet") {
      triggerEvent("connect", 2);
    }

    if (_id == "#confirm_swap") {
      $(_id).find(".popup_from_img").attr("src", $("#swap_from_img").attr("src"));
      $(_id).find(".popup_from_amount").text($(this).attr("data-from-amount"));
      $(_id).find(".popup_from_symbol").text($(this).attr("data-from-symbol"));
      $(_id).find(".popup_to_img").attr("src", $("#swap_to_img").attr("src"));
      $(_id).find(".popup_to_amount").text($(this).attr("data-to-amount"));
      $(_id).find(".popup_to_symbol").text($(this).attr("data-to-symbol"));
      $(_id)
        .find(".popup__body-desc")
        .text(
          `Output is estimated. You will receive at least ${$("#swap-min-received")
            .text()
            .trim()} or the transaction will revert.`
        );
      $(_id).find(".popup_price").text($(".swap-form__price-content-value").text());
      $(_id).find(".popup_min_received").text($("#swap-min-received").text());
      $(_id).find(".popup_price_impact").text($("#swap-price-impact").text());
      $(_id).find(".popup_lp_fee").text($("#swap-lp-fee").text());
    }

    if (_id == "#confirm_supply") {
      $(_id).find(".popup__body-content-title").text($(this).attr("data-title"));
      $(_id).find(".popup__body-content-reward-amount").text($(this).attr("data-value"));
      $(_id).find(".popup__body-content-reward-token0").attr("src", $(this).attr("data-from-logo"));
      $(_id).find(".popup__body-content-reward-token1").attr("src", $(this).attr("data-to-logo"));
      $(_id)
        .find(".popup__body-tesc")
        .text($(this).attr("data-from-symbol") + "/" + $(this).attr("data-to-symbol") + " Pool Tokens");
      $(_id)
        .find(".popup__body-details-item-name.token0")
        .text($(this).attr("data-from-symbol") + " Deposited");
      $(_id)
        .find(".popup__body-details-item-value.token0")
        .find(".popup__body-details-item-value-image")
        .attr("src", $(this).attr("data-from-logo"));
      $(_id)
        .find(".popup__body-details-item-value.token0")
        .find(".popup__body-details-item-value-text")
        .text($(this).attr("data-from-amount"));
      $(_id)
        .find(".popup__body-details-item-name.token1")
        .text($(this).attr("data-to-symbol") + " Deposited");
      $(_id)
        .find(".popup__body-details-item-value.token1")
        .find(".popup__body-details-item-value-image")
        .attr("src", $(this).attr("data-to-logo"));
      $(_id)
        .find(".popup__body-details-item-value.token1")
        .find(".popup__body-details-item-value-text")
        .text($(this).attr("data-to-amount"));
      $(_id).find(".popup__body-details-item-value.rates").html(`
        <div class="popup__body-details-item-value-rates">1 ${$(this).attr("data-from-symbol")} = ${$(this).attr(
        "data-from-rate"
      )} ${$(this).attr("data-to-symbol")}</div>
        <div class="popup__body-details-item-value-rates">1 ${$(this).attr("data-to-symbol")} = ${$(this).attr(
        "data-to-rate"
      )} ${$(this).attr("data-from-symbol")}</div>
      `);
      $(_id)
        .find(".popup__body-details-item-value.share-of-pool")
        .text($(this).attr("data-percent") + "%");
      $(_id).find("button.js-confirm-btn").text($(this).attr("data-text"));
    }

    if (_id == "#stake_asset") {
      $(_id).find("#stake_dialog_title").text($(this).attr("data-title"));

      const availableAmount = $(this).attr("data-amount");
      $(_id)
        .find(".available-balance-value")
        .text(`${new BigNumber(availableAmount).toFixed(8)} ${$(this).attr("data-name")}`);
      $(_id).find(".js-input-max-balance").attr("data-value", `${availableAmount}`);
      $(_id).find("#current_pool_id").val($(this).attr("data-id"));
      $(_id).find("#current_stake_type").val($(this).attr("data-type"));
      $(_id).find("#current_pool_pair_name").val($(this).attr("data-name"));
      $(_id).find("#available_amount").val("");

      $("#stake_asset .js-confirm-btn").attr("disabled", false);
    }

    if (_id == "#confirm_remove") {
      triggerEvent("initRemoveModal");
    }

    return false;
  });
  $(document).on("click", ".js-popup-close", function () {
    $(this).closest(".popup-overlay").removeAttr("data-input").fadeOut(200);
    document.body.style.overflow = "";
  });
  $(document).on("click touchend", function (e) {
    var container = $(".popup");
    if (container.length && !$(e.target).closest(container).length && $(".popup-overlay").is(":visible")) {
      $(".popup-overlay").removeAttr("data-input").fadeOut(200);
      document.body.style.overflow = "";
    }
  });
}

function selectToken(commonBases, tokens) {
  $(document).off("click", ".js-select-token");
  $(document).off("input", ".search-input input");
  $(".common-bases__items a:not(:first-child)").remove();
  commonBases.forEach((token) => {
    $(".common-bases__items").append(`
        <a class="cb-item js-select-token" href="#" data-key="${token.address}">
          <img src="${token.logoURI}" alt="">
          <span class="ticker">${token.symbol}</span>
        </a>
      `);
  });
  $(".token-list a:not(:first-child)").remove();
  tokens.forEach((token) => {
    $(".token-list").append(`
        <a class="token-list__item js-select-token" href="#" data-key="${token.address}"><img src="${token.logoURI}" alt="${token.name}">
          <div class="token-list__item-name">
            <div class="ticker">${token.symbol}</div>
            <div class="descr">${token.name}</div>
            <div class="hidden">${token.address}</div>
          </div>
        </a>
      `);
  });
  $(document).on("input", ".search-input input", function () {
    $(".search-input ~ .token-list .token-list__item").show();
    $(`.search-input ~ .token-list .token-list__item:not(:contains('${$(this).val()}'))`).hide();
    triggerEvent("searchChanged", $(this).val());
  });
  $(document).on("click", ".js-select-token", function (e) {
    if (!$(this).hasClass("selected")) {
      var thisTicker = $(this).find(".ticker").text();
      var thisLogoSrc = $(this).find("img").attr("src");
      var thisKey = $(this).attr("data-key");
      var thisInputName = $(this).closest(".popup-overlay").data("input");
      var thisInput = $('.swap-form__input-row[data-input="' + thisInputName + '"]');
      var thisSelect = $(thisInput).find(".select-token");
      var thisSelectIcon = $(thisSelect).find("img");
      var thisSelectTicker = $(thisSelect).find(".ticker");

      var otherSelect = $(
        '.swap-form__input-row[data-input="' + (thisInputName === "from" ? "to" : "from") + '"]'
      ).find(".select-token");
      if (thisKey === thisSelect.attr("data-key")) {
        // Do Nothing
      } else if (thisKey === otherSelect.attr("data-key")) {
        swapTokens();
      } else {
        thisSelect.addClass("selected");
        thisSelect.attr("data-key", thisKey);
        thisSelectIcon.attr("src", thisLogoSrc);
        thisSelectTicker.text(thisTicker);
        triggerEvent("onSelectToken", thisInputName, thisKey);
      }
      $(this).closest(".popup-overlay").removeData("input").fadeOut(200);
      document.body.style.overflow = "";
    } else e.preventDefault();
  });
}

function swapTokens() {
  const form = $(".swap-form");
  const inputFrom = form.find('.swap-form__input-row[data-input="from"]');
  inputFrom.find("input").attr("data-event-input", "onInputAmount:to");
  const inputFromHtml = inputFrom.html();
  const inputTo = form.find('.swap-form__input-row[data-input="to"]');
  inputTo.find("input").attr("data-event-input", "onInputAmount:from");
  var inputToHtml = inputTo.html();
  inputFrom.html(inputToHtml);
  $(inputTo).html(inputFromHtml);
  onSwapToken();
}

function swapInputs() {
  $(document).on("click", ".js-input-swap", function () {
    swapTokens();
  });
}

function seeMoreItems() {
  $(document).on("click", ".js-see-more", function () {
    $(this).prev().show();
  });
}

function darkMode() {
  $(document).on("input", ".dark-mode-toggle input", function () {
    var checkbox = $(this).find("input");
    if (checkbox.is(":checked")) {
      $("body").addClass("dark-mode");
    } else $("body").removeClass("dark-mode");
    services.toggleTheme();
  });
}

var TOKENS = {
  from: {},
  to: {},
};

function onSwapToken() {
  const { from, to } = TOKENS;
  TOKENS.from = to;
  TOKENS.to = from;
  $("#balance-from span").text(TOKENS.from && TOKENS.from.balance ? TOKENS.from.balance.dp(2, 1).toNumber() : "-");
  $("#balance-to span").text(TOKENS.to && TOKENS.to.balance ? TOKENS.to.balance.dp(2, 1).toNumber() : "-");
}
