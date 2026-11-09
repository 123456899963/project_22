/* P15 站内消息 */
(function () {
  var tab = "all";
  var listBox, emptyBox;
  var TYPES = {
    audit: { text: "审核", cls: "msg-type--audit" },
    correction: { text: "纠错", cls: "msg-type--correction" },
    report: { text: "投诉", cls: "msg-type--report" },
    system: { text: "系统", cls: "msg-type--system" }
  };

  function filtered() {
    return MM.store.messages().filter(function (m) {
      return tab === "all" || m.type === tab;
    });
  }

  function renderTabs() {
    var all = MM.store.messages();
    var unread = all.filter(function (m) { return !m.read; }).length;
    MM.dom.qsa("#msg-tabs button").forEach(function (btn) {
      var t = btn.getAttribute("data-tab");
      btn.classList.toggle("is-active", t === tab);
      var count = btn.querySelector(".tab-count");
      if (count) count.textContent = t === "all" ? all.length : "";
    });
    document.getElementById("read-all").disabled = unread === 0;
    document.getElementById("unread-count").textContent = "未读 " + unread + " 条 · 保留 180 天";
  }

  function render() {
    renderTabs();
    var list = filtered();
    if (!list.length) {
      listBox.innerHTML = "";
      emptyBox.classList.remove("hidden");
      emptyBox.innerHTML = MM.ui.emptyHTML({
        title: "暂无消息",
        desc: "投稿审核结果、纠错采纳与投诉处理都会在这里通知你。",
        actionText: "返回个人中心",
        actionHref: "profile.html"
      });
      return;
    }
    emptyBox.classList.add("hidden");
    listBox.innerHTML = list.map(function (m) {
      var t = TYPES[m.type] || TYPES.system;
      return '<a class="list-row msg-row" href="' + MM.dom.esc(m.target || "profile.html") + '" data-msg="' + m.id + '">' +
        (m.read ? '<span class="list-row__dot is-read"></span>' : '<span class="list-row__dot"></span>') +
        '<span class="msg-type ' + t.cls + '">' + t.text + "</span>" +
        '<div class="list-row__main">' +
          '<div class="list-row__title">' + MM.dom.esc(m.title) + "</div>" +
          '<div class="list-row__desc">' + MM.dom.esc(m.summary) + "</div>" +
        "</div>" +
        '<span class="list-row__time">' + MM.dom.esc(m.time) + "</span>" +
      "</a>";
    }).join("");
  }

  MM.dom.ready(function () {
    listBox = document.getElementById("msg-list");
    emptyBox = document.getElementById("msg-empty");
    if (!MM.store.requirePageLogin("messages.html", "查看站内消息")) return;
    MM.ui.initChrome("messages");
    render();

    document.getElementById("msg-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tab]");
      if (!btn) return;
      tab = btn.getAttribute("data-tab");
      render();
    });
    document.getElementById("read-all").addEventListener("click", function () {
      MM.store.markAllRead();
      MM.ui.refreshHeaderUser();
      render();
      MM.ui.toast("已全部标为已读");
    });
    listBox.addEventListener("click", function (e) {
      var row = e.target.closest("[data-msg]");
      if (!row) return;
      MM.store.markRead(row.getAttribute("data-msg"));
      MM.ui.refreshHeaderUser();
    });
  });
})();
