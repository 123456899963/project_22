/* 茗脉 · DOM 与字符串工具 */
window.MM = window.MM || {};

MM.dom = {
  qs: function (sel, root) { return (root || document).querySelector(sel); },
  qsa: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

  esc: function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  param: function (name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  },

  setParams: function (updates) {
    var sp = new URLSearchParams(window.location.search);
    Object.keys(updates).forEach(function (k) {
      var v = updates[k];
      if (v === "" || v == null) sp.delete(k); else sp.set(k, v);
    });
    var qs = sp.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  },

  highlight: function (text, keyword) {
    var safe = this.esc(text);
    if (!keyword) return safe;
    var kw = this.esc(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return safe.replace(new RegExp("(" + kw + ")", "gi"), "<mark>$1</mark>");
    } catch (e) { return safe; }
  },

  debounce: function (fn, wait) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  },

  ready: function (fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  },

  timeAgo: function (str) {
    return String(str || "").slice(0, 16);
  }
};
